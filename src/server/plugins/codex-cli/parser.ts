import { readFile } from "node:fs/promises";
import type {
  AssistantTurn,
  ContentBlock,
  Session,
  TokenUsage,
  ToolCallWithResult,
  Turn,
  UserTurn,
} from "../../../shared/types.ts";
import { findCodexSessionFileById, isCodexSessionMeta } from "./session-index.ts";
import { iterateJsonl } from "../shared/jsonl-utils.ts";

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
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

let toolUseCounter = 0;

function nextToolUseId(): string {
  toolUseCounter++;
  return `codex-tool-${toolUseCounter}`;
}

function buildToolCallFromItem(item: CodexItem): ToolCallWithResult | null {
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

function createUserTurn(text: string, timestamp: string): UserTurn {
  return {
    kind: "user",
    uuid: `codex-user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp,
    text,
  };
}

function createAssistantTurn(model: string, timestamp: string): AssistantTurn {
  return {
    kind: "assistant",
    uuid: `codex-assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp,
    model,
    contentBlocks: [],
  };
}

function itemToContentBlock(item: CodexItem): ContentBlock | null {
  if (item.type === "agent_message") {
    return { type: "text", text: item.text };
  }
  if (item.type === "reasoning") {
    return { type: "thinking", block: { text: item.text } };
  }
  const toolCall = buildToolCallFromItem(item);
  if (toolCall) {
    return { type: "tool_call", call: toolCall };
  }
  return null;
}

function handleTurnStarted(state: TurnBuilderState, timestamp: string): void {
  flushAssistant(state);
  state.turnCount++;
  if (state.turnCount > 1) {
    state.turns.push(createUserTurn("", timestamp));
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
): void {
  if (!event.item) return;

  if (!state.currentAssistant) {
    state.currentAssistant = createAssistantTurn(model, timestamp);
  }

  const block = itemToContentBlock(event.item);
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
}

export function buildCodexTurns(events: CodexEvent[], model: string, timestamp: string): Turn[] {
  // Reset counter for each session parse
  toolUseCounter = 0;

  const state: TurnBuilderState = {
    turns: [],
    currentAssistant: null,
    turnCount: 0,
  };

  for (const event of events) {
    if (event.type === "turn.started") {
      handleTurnStarted(state, timestamp);
    } else if (event.type === "turn.completed") {
      handleTurnCompleted(state, event);
    } else if (event.type === "item.completed") {
      handleItemCompleted(state, event, model, timestamp);
    }
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
    if (lineIndex === 0 && isCodexSessionMeta(parsed)) {
        meta = parsed;
        return;
    }

    if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
      events.push(parsed as CodexEvent);
    }
  });

  const metaInfo = isCodexSessionMeta(meta) ? meta : null;
  const model = metaInfo?.model || "unknown";
  const timestamp = metaInfo ? new Date(metaInfo.timestamps.created * 1000).toISOString() : "";

  const turns = buildCodexTurns(events, model, timestamp);

  return {
    sessionId,
    project: _nativeId,
    turns,
    pluginId: "codex-cli",
  };
}
