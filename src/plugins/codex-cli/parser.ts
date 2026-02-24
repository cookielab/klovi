import { readFile } from "node:fs/promises";
import { epochSecondsToIso } from "../../shared/iso-time.ts";
import type {
  AssistantTurn,
  ContentBlock,
  Session,
  TokenUsage,
  ToolCallWithResult,
  Turn,
  UserTurn,
} from "../../shared/types.ts";
import { iterateJsonl } from "../shared/jsonl-utils.ts";
import { findCodexSessionFileById, normalizeSessionMeta } from "./session-index.ts";

interface CodexItemCommand {
  type: "command_execution";
  command: string;
  aggregated_output?: string;
  exit_code?: number;
}

interface CodexItemFileChange {
  type: "file_change";
  changes: { path: string; kind: string }[];
}

interface CodexItemMcp {
  type: "mcp_tool_call";
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
  result?: string;
}

interface CodexItemWebSearch {
  type: "web_search";
  query: string;
}

interface CodexItemAgentMessage {
  type: "agent_message";
  text: string;
}

interface CodexItemReasoning {
  type: "reasoning";
  text: string;
}

type CodexItem =
  | CodexItemCommand
  | CodexItemFileChange
  | CodexItemMcp
  | CodexItemWebSearch
  | CodexItemAgentMessage
  | CodexItemReasoning;

export interface CodexEvent {
  type: string;
  item?: CodexItem;
  text?: string;
  callId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

interface EnvelopePayload {
  type?: string;
  message?: string;
  text?: string;
  name?: string;
  call_id?: string;
  input?: string;
  output?: string;
  arguments?: Record<string, unknown> | string;
  role?: string;
  content?: { type: string; text?: string }[];
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  info?: {
    last_token_usage?: {
      input_tokens?: number;
      cached_input_tokens?: number;
      output_tokens?: number;
    };
  } | null;
  [key: string]: unknown;
}

interface EnvelopeEvent {
  type: string;
  timestamp?: string;
  payload?: EnvelopePayload;
}

function normalizeEventMsg(payload: EnvelopePayload): CodexEvent | null {
  switch (payload.type) {
    case "task_started":
      return { type: "turn.started" };
    case "user_message":
      return { type: "user_message", text: payload.message || payload.text || "" };
    case "agent_message":
      return {
        type: "item.completed",
        item: { type: "agent_message", text: payload.message || payload.text || "" },
      };
    case "agent_reasoning":
      return {
        type: "item.completed",
        item: { type: "reasoning", text: payload.text || "" },
      };
    case "token_count": {
      const src = payload.info?.last_token_usage ?? payload;
      return {
        type: "usage_update",
        usage: {
          input_tokens: src.input_tokens,
          cached_input_tokens: src.cached_input_tokens,
          output_tokens: src.output_tokens,
        },
      };
    }
    case "task_complete":
      return { type: "turn.completed" };
    default:
      return null;
  }
}

function parseArguments(
  args: Record<string, unknown> | string | undefined,
): Record<string, unknown> {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return { raw: args };
    }
  }
  return args;
}

function normalizeResponseItem(payload: EnvelopePayload): CodexEvent | null {
  if (payload.type === "function_call" || payload.type === "custom_tool_call") {
    const name = payload.name || "unknown";
    const args = parseArguments(payload.arguments);
    return {
      type: "item.completed",
      item: {
        type: "command_execution",
        command: name,
        aggregated_output: "",
        exit_code: 0,
      },
      // Store call_id and parsed args for the generic tool call path
      callId: payload.call_id,
      toolName: name,
      toolInput: args,
    };
  }
  if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
    return {
      type: "tool_output",
      callId: payload.call_id,
      text: payload.output || "",
    };
  }
  return null;
}

const OLD_FORMAT_TYPES = new Set([
  "turn.started",
  "turn.completed",
  "item.completed",
  "thread.started",
]);

function normalizeEvent(raw: unknown): CodexEvent | null {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) return null;
  const obj = raw as EnvelopeEvent;

  if (OLD_FORMAT_TYPES.has(obj.type)) return raw as CodexEvent;

  const payload = obj.payload;
  if (!payload) return null;

  if (obj.type === "event_msg") return normalizeEventMsg(payload);
  if (obj.type === "response_item") return normalizeResponseItem(payload);
  return null;
}

function buildToolCallFromItem(
  item: CodexItem,
  nextToolUseId: () => string,
): ToolCallWithResult | null {
  switch (item.type) {
    case "command_execution":
      return {
        toolUseId: nextToolUseId(),
        name: "command_execution",
        input: { command: item.command },
        result: item.aggregated_output || "",
        isError: item.exit_code !== undefined && item.exit_code !== 0,
      };
    case "file_change":
      return {
        toolUseId: nextToolUseId(),
        name: "file_change",
        input: { changes: item.changes },
        result: "",
        isError: false,
      };
    case "mcp_tool_call":
      return {
        toolUseId: nextToolUseId(),
        name: item.tool,
        input: item.arguments,
        result: item.result || "",
        isError: false,
      };
    case "web_search":
      return {
        toolUseId: nextToolUseId(),
        name: "web_search",
        input: { query: item.query },
        result: "",
        isError: false,
      };
    default:
      return null;
  }
}

function createUserTurn(text: string, timestamp: string, uuid: string): UserTurn {
  return {
    kind: "user",
    uuid,
    timestamp,
    text,
  };
}

function createAssistantTurn(model: string, timestamp: string, uuid: string): AssistantTurn {
  return {
    kind: "assistant",
    uuid,
    timestamp,
    model,
    contentBlocks: [],
  };
}

function itemToContentBlock(item: CodexItem, nextToolUseId: () => string): ContentBlock | null {
  if (item.type === "agent_message") {
    return { type: "text", text: item.text };
  }
  if (item.type === "reasoning") {
    return { type: "thinking", block: { text: item.text } };
  }
  const toolCall = buildToolCallFromItem(item, nextToolUseId);
  if (toolCall) {
    return { type: "tool_call", call: toolCall };
  }
  return null;
}

function handleTurnStarted(
  state: TurnBuilderState,
  event: CodexEvent,
  timestamp: string,
  nextUserTurnId: () => string,
): void {
  flushAssistant(state);
  state.turnCount++;
  if (state.turnCount > 1) {
    state.turns.push(createUserTurn(event.text || "", timestamp, nextUserTurnId()));
  }
}

function handleTurnCompleted(state: TurnBuilderState, event: CodexEvent): void {
  if (state.currentAssistant && event.usage) {
    const usage: TokenUsage = {
      inputTokens: event.usage.input_tokens ?? 0,
      outputTokens: event.usage.output_tokens ?? 0,
      cacheReadTokens: event.usage.cached_input_tokens,
    };
    state.currentAssistant.usage = usage;
  }
  flushAssistant(state);
}

function handleItemCompleted(
  state: TurnBuilderState,
  event: CodexEvent,
  model: string,
  timestamp: string,
  nextToolUseId: () => string,
  nextAssistantTurnId: () => string,
): void {
  if (!event.item) return;

  if (!state.currentAssistant) {
    state.currentAssistant = createAssistantTurn(model, timestamp, nextAssistantTurnId());
  }

  const block = itemToContentBlock(event.item, nextToolUseId);
  if (block) {
    state.currentAssistant.contentBlocks.push(block);
  }
}

function flushAssistant(state: TurnBuilderState): void {
  if (state.currentAssistant && state.currentAssistant.contentBlocks.length > 0) {
    state.turns.push(state.currentAssistant);
  }
  state.currentAssistant = null;
}

interface TurnBuilderState {
  turns: Turn[];
  currentAssistant: AssistantTurn | null;
  turnCount: number;
  /** Maps call_id → ToolCallWithResult for new-format function_call_output matching */
  pendingToolCalls: Map<string, ToolCallWithResult>;
}

function handleUserMessage(state: TurnBuilderState, event: CodexEvent): void {
  // Find the last user turn and set its text
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const turn = state.turns[i]!;
    if (turn.kind === "user" && !turn.text) {
      turn.text = event.text || "";
      return;
    }
  }
  // If no user turn yet (first message), create one
  if (state.turnCount === 0) {
    state.turnCount++;
  }
  state.turns.push(createUserTurn(event.text || "", "", "codex-user-first"));
}

function handleUsageUpdate(state: TurnBuilderState, event: CodexEvent): void {
  if (state.currentAssistant && event.usage) {
    const usage: TokenUsage = {
      inputTokens: event.usage.input_tokens ?? 0,
      outputTokens: event.usage.output_tokens ?? 0,
      cacheReadTokens: event.usage.cached_input_tokens,
    };
    state.currentAssistant.usage = usage;
  }
}

function handleToolOutput(state: TurnBuilderState, event: CodexEvent): void {
  if (!event.callId) return;
  const toolCall = state.pendingToolCalls.get(event.callId);
  if (toolCall) {
    toolCall.result = event.text || "";
  }
}

function handleGenericToolCall(
  state: TurnBuilderState,
  event: CodexEvent,
  model: string,
  timestamp: string,
  nextToolUseId: () => string,
  nextAssistantTurnId: () => string,
): void {
  if (!state.currentAssistant) {
    state.currentAssistant = createAssistantTurn(model, timestamp, nextAssistantTurnId());
  }
  const toolCall: ToolCallWithResult = {
    toolUseId: event.callId || nextToolUseId(),
    name: event.toolName || "unknown",
    input: event.toolInput || {},
    result: "",
    isError: false,
  };
  if (event.callId) {
    state.pendingToolCalls.set(event.callId, toolCall);
  }
  state.currentAssistant.contentBlocks.push({ type: "tool_call", call: toolCall });
}

function dispatchEvent(
  state: TurnBuilderState,
  event: CodexEvent,
  model: string,
  timestamp: string,
  nextToolUseId: () => string,
  nextUserTurnId: () => string,
  nextAssistantTurnId: () => string,
): void {
  switch (event.type) {
    case "turn.started":
      handleTurnStarted(state, event, timestamp, nextUserTurnId);
      break;
    case "turn.completed":
      handleTurnCompleted(state, event);
      break;
    case "item.completed":
      if (event.toolName) {
        handleGenericToolCall(state, event, model, timestamp, nextToolUseId, nextAssistantTurnId);
      } else {
        handleItemCompleted(state, event, model, timestamp, nextToolUseId, nextAssistantTurnId);
      }
      break;
    case "usage_update":
      handleUsageUpdate(state, event);
      break;
    case "user_message":
      handleUserMessage(state, event);
      break;
    case "tool_output":
      handleToolOutput(state, event);
      break;
  }
}

export function buildCodexTurns(events: CodexEvent[], model: string, timestamp: string): Turn[] {
  let toolUseCounter = 0;
  let userTurnCounter = 0;
  let assistantTurnCounter = 0;

  const nextToolUseId = () => {
    toolUseCounter++;
    return `codex-tool-${toolUseCounter}`;
  };
  const nextUserTurnId = () => {
    userTurnCounter++;
    return `codex-user-${userTurnCounter}`;
  };
  const nextAssistantTurnId = () => {
    assistantTurnCounter++;
    return `codex-assistant-${assistantTurnCounter}`;
  };

  const state: TurnBuilderState = {
    turns: [],
    currentAssistant: null,
    turnCount: 0,
    pendingToolCalls: new Map(),
  };

  for (const event of events) {
    dispatchEvent(
      state,
      event,
      model,
      timestamp,
      nextToolUseId,
      nextUserTurnId,
      nextAssistantTurnId,
    );
  }

  flushAssistant(state);
  return state.turns;
}

export async function loadCodexSession(_nativeId: string, sessionId: string): Promise<Session> {
  const filePath = await findCodexSessionFileById(sessionId);
  if (!filePath) {
    return {
      sessionId,
      project: _nativeId,
      turns: [],
      pluginId: "codex-cli",
    };
  }

  const text = await readFile(filePath, "utf-8");

  let meta: unknown = null;
  const events: CodexEvent[] = [];

  iterateJsonl(text, ({ parsed, lineIndex }) => {
    if (lineIndex === 0) {
      const normalized = normalizeSessionMeta(parsed);
      if (normalized) {
        meta = normalized;
        return;
      }
    }

    const event = normalizeEvent(parsed);
    if (event) {
      events.push(event);
    }
  });

  const metaInfo = normalizeSessionMeta(meta);
  const model = metaInfo?.model || "unknown";
  const timestamp = metaInfo ? epochSecondsToIso(metaInfo.timestamps.created) : "";

  const turns = buildCodexTurns(events, model, timestamp);

  return {
    sessionId,
    project: _nativeId,
    turns,
    pluginId: "codex-cli",
  };
}
