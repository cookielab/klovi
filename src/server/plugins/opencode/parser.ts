import type {
  AssistantTurn,
  ContentBlock,
  Session,
  TokenUsage,
  ToolCallWithResult,
  Turn,
  UserTurn,
} from "../../../shared/types.ts";
import { epochMsToIso } from "../../iso-time.ts";
import { tryParseJson } from "../shared/json-utils.ts";
import { openOpenCodeDb, type SqliteDb } from "./db.ts";

// --- DB row types ---

interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
}

interface PartRow {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  data: string;
}

// --- Parsed message data ---

interface MessageDataUser {
  role: "user";
  time?: { created?: number };
  agent?: string;
  model?: { providerID?: string; modelID?: string };
}

interface MessageDataAssistant {
  role: "assistant";
  time?: { created?: number; completed?: number };
  modelID?: string;
  providerID?: string;
  agent?: string;
  cost?: number;
  tokens?: {
    total?: number;
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
  finish?: string;
}

type MessageData = MessageDataUser | MessageDataAssistant;

// --- Parsed part data ---

interface PartDataText {
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
}

interface PartDataReasoning {
  type: "reasoning";
  text: string;
}

interface ToolStateCompleted {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { start: number; end: number };
}

interface ToolStateError {
  status: "error";
  input: Record<string, unknown>;
  error: string;
  time: { start: number; end: number };
}

interface ToolStatePending {
  status: "pending";
  input: Record<string, unknown>;
}

interface ToolStateRunning {
  status: "running";
  input: Record<string, unknown>;
}

interface PartDataTool {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolStateCompleted | ToolStateError | ToolStatePending | ToolStateRunning;
}

interface PartDataFile {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
}

interface PartDataSnapshot {
  type: "snapshot";
  snapshot: string;
}

interface PartDataStepFinish {
  type: "step-finish";
  reason: string;
  cost: number;
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
}

interface PartDataOther {
  type: "step-start" | "patch" | "agent" | "compaction" | "subtask" | "retry";
}

type PartData =
  | PartDataText
  | PartDataReasoning
  | PartDataTool
  | PartDataFile
  | PartDataSnapshot
  | PartDataStepFinish
  | PartDataOther;

// --- Turn building ---

function partToContentBlock(partData: PartData, nextToolUseId: () => string): ContentBlock | null {
  switch (partData.type) {
    case "text": {
      const textPart = partData as PartDataText;
      if (textPart.ignored) return null;
      return { type: "text", text: textPart.text };
    }
    case "reasoning": {
      const reasoningPart = partData as PartDataReasoning;
      return { type: "thinking", block: { text: reasoningPart.text } };
    }
    case "tool": {
      const toolPart = partData as PartDataTool;
      return { type: "tool_call", call: buildToolCall(toolPart, nextToolUseId) };
    }
    default:
      return null;
  }
}

function buildToolCall(toolPart: PartDataTool, nextToolUseId: () => string): ToolCallWithResult {
  const state = toolPart.state;
  const toolId = toolPart.callID || nextToolUseId();

  switch (state.status) {
    case "completed":
      return {
        toolUseId: toolId,
        name: toolPart.tool,
        input: state.input,
        result: state.output,
        isError: false,
      };
    case "error":
      return {
        toolUseId: toolId,
        name: toolPart.tool,
        input: state.input,
        result: state.error,
        isError: true,
      };
    case "pending":
    case "running":
      return {
        toolUseId: toolId,
        name: toolPart.tool,
        input: state.input,
        result: "[Tool execution was interrupted]",
        isError: true,
      };
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

function createAssistantTurn(
  model: string,
  timestamp: string,
  uuid: string,
  contentBlocks: ContentBlock[],
  usage?: TokenUsage,
  stopReason?: string,
): AssistantTurn {
  return {
    kind: "assistant",
    uuid,
    timestamp,
    model,
    contentBlocks,
    usage,
    stopReason,
  };
}

// --- Exported helpers for testing ---

export interface OpenCodeMessage {
  id: string;
  data: MessageData;
  timeCreated: number;
  parts: PartData[];
}

function collectUserText(parts: PartData[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && !(part as PartDataText).ignored) {
      texts.push((part as PartDataText).text);
    }
  }
  return texts.join("\n");
}

function collectContentBlocks(parts: PartData[], nextToolUseId: () => string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const part of parts) {
    const block = partToContentBlock(part, nextToolUseId);
    if (block) blocks.push(block);
  }
  return blocks;
}

function tokensToUsage(tokens: MessageDataAssistant["tokens"]): TokenUsage | undefined {
  if (!tokens) return undefined;
  return {
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cacheReadTokens: tokens.cache?.read,
    cacheCreationTokens: tokens.cache?.write,
  };
}

function extractStepFinishUsage(parts: PartData[]): TokenUsage | undefined {
  for (const part of parts) {
    if (part.type === "step-finish") {
      const sf = part as PartDataStepFinish;
      return {
        inputTokens: sf.tokens.input,
        outputTokens: sf.tokens.output,
        cacheReadTokens: sf.tokens.cache?.read,
        cacheCreationTokens: sf.tokens.cache?.write,
      };
    }
  }
  return undefined;
}

function buildUserTurn(msg: OpenCodeMessage, timestamp: string): UserTurn {
  return createUserTurn(collectUserText(msg.parts), timestamp, msg.id);
}

function buildAssistantTurnFromMsg(
  msg: OpenCodeMessage,
  timestamp: string,
  nextToolUseId: () => string,
): AssistantTurn {
  const data = msg.data as MessageDataAssistant;
  const model = data.modelID || "unknown";
  const contentBlocks = collectContentBlocks(msg.parts, nextToolUseId);
  const usage = tokensToUsage(data.tokens) ?? extractStepFinishUsage(msg.parts);
  return createAssistantTurn(model, timestamp, msg.id, contentBlocks, usage, data.finish);
}

export function buildOpenCodeTurns(messages: OpenCodeMessage[]): Turn[] {
  let toolUseCounter = 0;
  const nextToolUseId = () => {
    toolUseCounter++;
    return `opencode-tool-${toolUseCounter}`;
  };

  const turns: Turn[] = [];

  for (const msg of messages) {
    const timestamp = epochMsToIso(msg.timeCreated);
    if (msg.data.role === "user") {
      turns.push(buildUserTurn(msg, timestamp));
    } else if (msg.data.role === "assistant") {
      turns.push(buildAssistantTurnFromMsg(msg, timestamp, nextToolUseId));
    }
  }

  return turns;
}

// --- Session loading ---

function groupPartsByMessage(partRows: PartRow[]): Map<string, PartRow[]> {
  const map = new Map<string, PartRow[]>();
  for (const part of partRows) {
    const existing = map.get(part.message_id);
    if (existing) {
      existing.push(part);
    } else {
      map.set(part.message_id, [part]);
    }
  }
  return map;
}

function parsePartRows(rawParts: PartRow[]): PartData[] {
  const parts: PartData[] = [];
  for (const rawPart of rawParts) {
    const parsedPart = tryParseJson<PartData>(rawPart.data);
    if (parsedPart) {
      parts.push(parsedPart);
    }
  }
  return parts;
}

function buildMessagesFromRows(
  messageRows: MessageRow[],
  partsByMessage: Map<string, PartRow[]>,
): OpenCodeMessage[] {
  const messages: OpenCodeMessage[] = [];
  for (const row of messageRows) {
    const data = tryParseJson<MessageData>(row.data);
    if (data) {
      const rawParts = partsByMessage.get(row.id) ?? [];
      messages.push({
        id: row.id,
        data,
        timeCreated: row.time_created,
        parts: parsePartRows(rawParts),
      });
    }
  }
  return messages;
}

function loadSessionFromDb(db: SqliteDb, nativeId: string, sessionId: string): Session {
  const sessionRow = db
    .query<{ directory: string }>("SELECT directory FROM session WHERE id = ?")
    .get(sessionId);

  const project = sessionRow?.directory || nativeId;

  const messageRows = db
    .query<MessageRow>(
      `SELECT id, session_id, time_created, data
       FROM message WHERE session_id = ? ORDER BY time_created ASC`,
    )
    .all(sessionId);

  if (messageRows.length === 0) {
    return emptySession(project, sessionId);
  }

  const partRows = db
    .query<PartRow>(
      `SELECT id, message_id, session_id, time_created, data
       FROM part WHERE session_id = ? ORDER BY message_id, id ASC`,
    )
    .all(sessionId);

  const partsByMessage = groupPartsByMessage(partRows);
  const messages = buildMessagesFromRows(messageRows, partsByMessage);
  const turns = buildOpenCodeTurns(messages);

  return { sessionId, project, turns, pluginId: "opencode" };
}

export async function loadOpenCodeSession(nativeId: string, sessionId: string): Promise<Session> {
  const db = await openOpenCodeDb();
  if (!db) {
    return emptySession(nativeId, sessionId);
  }

  try {
    return loadSessionFromDb(db, nativeId, sessionId);
  } catch {
    return emptySession(nativeId, sessionId);
  } finally {
    db.close();
  }
}

function emptySession(project: string, sessionId: string): Session {
  return {
    sessionId,
    project,
    turns: [],
    pluginId: "opencode",
  };
}
