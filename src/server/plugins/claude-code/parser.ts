import { join } from "node:path";
import type {
  AssistantTurn,
  Attachment,
  ParseErrorTurn,
  Session,
  SessionSummary,
  ToolCallWithResult,
  ToolResultImage,
  Turn,
  UserTurn,
} from "../../../shared/types.ts";
import { getProjectsDir } from "../../config.ts";
import { parseCommandMessage } from "../../parser/command-message.ts";
import type { RawContentBlock, RawLine, RawToolResultBlock } from "../../parser/types.ts";
import { iterateJsonl } from "../shared/jsonl-utils.ts";

interface ParsedSession {
  session: Session;
  slug: string | undefined;
}

export async function loadClaudeSession(
  nativeId: string,
  sessionId: string,
): Promise<ParsedSession> {
  const { rawLines, parseErrors } = await readJsonlLines(
    join(getProjectsDir(), nativeId, `${sessionId}.jsonl`),
  );

  const subAgentMap = extractSubAgentMap(rawLines);
  const slug = extractSlug(rawLines);
  const turns = buildTurns(rawLines, parseErrors);

  // Attach subAgentId to Task tool calls
  for (const turn of turns) {
    if (turn.kind !== "assistant") continue;
    for (const block of turn.contentBlocks) {
      if (block.type === "tool_call" && block.call.name === "Task") {
        const agentId = subAgentMap.get(block.call.toolUseId);
        if (agentId) {
          block.call.subAgentId = agentId;
        }
      }
    }
  }

  return {
    session: {
      sessionId,
      project: nativeId,
      turns,
      pluginId: "claude-code",
    },
    slug,
  };
}

export async function parseSubAgentSession(
  sessionId: string,
  encodedPath: string,
  agentId: string,
): Promise<Session> {
  const filePath = join(
    getProjectsDir(),
    encodedPath,
    sessionId,
    "subagents",
    `agent-${agentId}.jsonl`,
  );

  let parsed: ParsedLines;
  try {
    parsed = await readJsonlLines(filePath);
  } catch {
    return { sessionId, project: encodedPath, turns: [] };
  }

  const subAgentMap = extractSubAgentMap(parsed.rawLines);
  const turns = buildTurns(parsed.rawLines, parsed.parseErrors);

  for (const turn of turns) {
    if (turn.kind !== "assistant") continue;
    for (const block of turn.contentBlocks) {
      if (block.type === "tool_call" && block.call.name === "Task") {
        const nestedAgentId = subAgentMap.get(block.call.toolUseId);
        if (nestedAgentId) {
          block.call.subAgentId = nestedAgentId;
        }
      }
    }
  }

  return { sessionId, project: encodedPath, turns };
}

const AGENT_ID_RE = /agentId:\s*(\w+)/;

function extractFromProgressEvent(line: RawLine, map: Map<string, string>): void {
  if (
    line.type === "progress" &&
    line.parentToolUseID &&
    line.data?.type === "agent_progress" &&
    line.data.agentId
  ) {
    map.set(line.parentToolUseID, line.data.agentId);
  }
}

function extractToolResultText(tr: RawToolResultBlock): string {
  if (typeof tr.content === "string") return tr.content;
  if (Array.isArray(tr.content)) {
    return tr.content
      .filter((c) => c.type === "text" && "text" in c)
      .map((c) => ("text" in c ? c.text : ""))
      .join("");
  }
  return "";
}

function extractFromToolResult(line: RawLine, map: Map<string, string>): void {
  if (line.type !== "user" || !line.message || !Array.isArray(line.message.content)) return;
  for (const block of line.message.content) {
    if (block.type !== "tool_result") continue;
    const tr = block as RawToolResultBlock;
    const match = AGENT_ID_RE.exec(extractToolResultText(tr));
    if (match?.[1]) {
      map.set(tr.tool_use_id, match[1]);
    }
  }
}

export function extractSubAgentMap(lines: RawLine[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    extractFromProgressEvent(line, map);
    extractFromToolResult(line, map);
  }
  return map;
}

export function extractSlug(lines: RawLine[]): string | undefined {
  for (const line of lines) {
    if (line.slug) return line.slug;
  }
  return undefined;
}

const PLAN_PREFIX = "Implement the following plan";

const STATUS_RE = /^\[.+\]$/;

export function findPlanSessionId(
  turns: Turn[],
  slug: string | undefined,
  sessions: SessionSummary[],
  currentSessionId: string,
): string | undefined {
  const planTurn = turns.find((t) => t.kind === "user" && !STATUS_RE.test(t.text.trim())) as
    | UserTurn
    | undefined;
  if (!planTurn || !planTurn.text.startsWith(PLAN_PREFIX)) return undefined;
  if (!slug) return undefined;
  const match = sessions.find((s) => s.slug === slug && s.sessionId !== currentSessionId);
  return match?.sessionId;
}

export function findImplSessionId(
  slug: string | undefined,
  sessions: SessionSummary[],
  currentSessionId: string,
): string | undefined {
  if (!slug) return undefined;
  const match = sessions.find(
    (s) =>
      s.slug === slug && s.sessionId !== currentSessionId && s.firstMessage.startsWith(PLAN_PREFIX),
  );
  return match?.sessionId;
}

interface ParsedLines {
  rawLines: RawLine[];
  parseErrors: ParseErrorTurn[];
}

async function readJsonlLines(filePath: string): Promise<ParsedLines> {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(filePath, "utf-8");

  const rawLines: RawLine[] = [];
  const parseErrors: ParseErrorTurn[] = [];

  iterateJsonl(
    text,
    ({ parsed }) => {
      rawLines.push(parsed as RawLine);
    },
    {
      onMalformed: (line, lineNumber, error) => {
      parseErrors.push({
        kind: "parse_error",
        uuid: `parse-error-line-${lineNumber}`,
        timestamp: rawLines[rawLines.length - 1]?.timestamp ?? "",
        lineNumber,
        rawLine: line.length > 500 ? `${line.slice(0, 500)}\u2026 (truncated)` : line,
        errorType: "json_parse",
        errorDetails: error instanceof Error ? error.message : undefined,
      });
      },
    },
  );

  return { rawLines, parseErrors };
}

function isDisplayableLine(l: RawLine): boolean {
  if (l.type === "progress") return false;
  if (l.type === "file-history-snapshot") return false;
  if (l.type === "summary") return false;
  if (l.isMeta) return false;
  if (!l.message) return false;
  return true;
}

function collectToolResults(
  displayable: RawLine[],
): Map<string, { content: string; isError: boolean; images: ToolResultImage[] }> {
  const toolResults = new Map<
    string,
    { content: string; isError: boolean; images: ToolResultImage[] }
  >();
  for (const line of displayable) {
    if (line.type !== "user" || !line.message) continue;
    const content = line.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "tool_result") {
        const tr = block as RawToolResultBlock;
        const { text, images } = extractToolResult(tr);
        toolResults.set(tr.tool_use_id, {
          content: text,
          isError: tr.is_error ?? false,
          images,
        });
      }
    }
  }
  return toolResults;
}

function extractUserContent(content: string | RawContentBlock[]): {
  text: string;
  attachments: Attachment[];
} {
  if (typeof content === "string") return { text: content, attachments: [] };
  const textBlocks = content.filter((b) => b.type === "text");
  const text = textBlocks.map((b) => ("text" in b ? b.text : "")).join("\n");
  const attachments: Attachment[] = [];
  for (const block of content) {
    if (block.type === "image" && "source" in block) {
      attachments.push({
        type: "image",
        mediaType: (block as { source: { media_type: string } }).source.media_type,
      });
    }
  }
  return { text, attachments };
}

function isSkippedUserText(text: string): boolean {
  return (
    text.startsWith("<local-command") ||
    text.startsWith("<command-name") ||
    text.startsWith("<task-notification") ||
    text.startsWith("<system-reminder")
  );
}

const BASH_INPUT_RE = /<bash-input>([\s\S]*?)<\/bash-input>/;
const IDE_OPENED_FILE_RE =
  /<ide_opened_file>[\s\S]*?opened the file (.*?) in the IDE[\s\S]*?<\/ide_opened_file>/;
function parseSpecialUserContent(
  text: string,
): { bashInput: string } | { ideOpenedFile: string } | null {
  const bashMatch = BASH_INPUT_RE.exec(text);
  if (bashMatch?.[1] !== undefined) return { bashInput: bashMatch[1] };

  const ideMatch = IDE_OPENED_FILE_RE.exec(text);
  if (ideMatch?.[1] !== undefined) return { ideOpenedFile: ideMatch[1] };

  return null;
}

function processUserLine(line: RawLine): UserTurn | "tool_result_only" | null {
  if (!line.message) return null;
  const content = line.message.content;

  if (Array.isArray(content) && content.every((b) => b.type === "tool_result")) {
    return "tool_result_only";
  }

  const { text, attachments } = extractUserContent(content);

  const special = parseSpecialUserContent(text);
  if (special) {
    return {
      kind: "user",
      uuid: line.uuid || "",
      timestamp: line.timestamp || "",
      text: "",
      ...special,
    };
  }

  if (isSkippedUserText(text)) return null;

  const command = parseCommandMessage(text);
  return {
    kind: "user",
    uuid: line.uuid || "",
    timestamp: line.timestamp || "",
    text: command ? command.args : text,
    command: command ?? undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function createAssistantTurn(line: RawLine): AssistantTurn {
  return {
    kind: "assistant",
    uuid: line.uuid || "",
    timestamp: line.timestamp || "",
    model: line.message!.model || "",
    contentBlocks: [],
  };
}

type ToolResultMap = Map<string, { content: string; isError: boolean; images: ToolResultImage[] }>;

function buildToolCall(block: RawContentBlock, toolResults: ToolResultMap): ToolCallWithResult {
  const result = toolResults.get((block as { id: string }).id);
  const toolCall: ToolCallWithResult = {
    toolUseId: (block as { id: string }).id,
    name: (block as { name: string }).name,
    input: (block as { input: Record<string, unknown> }).input,
    result: result?.content ?? "",
    isError: result?.isError ?? false,
  };
  if (result?.images && result.images.length > 0) {
    toolCall.resultImages = result.images;
  }
  return toolCall;
}

function processContentBlock(
  block: RawContentBlock,
  current: AssistantTurn,
  toolResults: ToolResultMap,
): void {
  if (block.type === "thinking" && "thinking" in block) {
    current.contentBlocks.push({ type: "thinking", block: { text: block.thinking } });
  } else if (block.type === "text" && "text" in block && block.text.trim()) {
    current.contentBlocks.push({ type: "text", text: block.text });
  } else if (block.type === "tool_use" && "id" in block) {
    current.contentBlocks.push({ type: "tool_call", call: buildToolCall(block, toolResults) });
  }
}

function processAssistantLine(
  line: RawLine,
  current: AssistantTurn,
  toolResults: ToolResultMap,
): void {
  const msg = line.message!;
  if (msg.usage) {
    current.usage = {
      inputTokens: msg.usage.input_tokens ?? 0,
      outputTokens: msg.usage.output_tokens ?? 0,
      cacheReadTokens: msg.usage.cache_read_input_tokens,
      cacheCreationTokens: msg.usage.cache_creation_input_tokens,
    };
  }
  if (msg.stop_reason) {
    current.stopReason = msg.stop_reason;
  }
  for (const block of msg.content as RawContentBlock[]) {
    processContentBlock(block, current, toolResults);
  }
}

function flushAssistant(current: AssistantTurn | null, turns: Turn[]): null {
  if (current) turns.push(current);
  return null;
}

function handleUserLine(
  line: RawLine,
  currentAssistant: AssistantTurn | null,
  turns: Turn[],
): AssistantTurn | null {
  const result = processUserLine(line);
  if (result === "tool_result_only") return currentAssistant;
  const flushed = flushAssistant(currentAssistant, turns);
  if (result) turns.push(result);
  return flushed;
}

function handleAssistantLine(
  line: RawLine,
  currentAssistant: AssistantTurn | null,
  toolResults: ToolResultMap,
  structureErrors: ParseErrorTurn[],
): AssistantTurn | null {
  if (!line.message) return currentAssistant;
  if (!Array.isArray(line.message.content)) {
    structureErrors.push({
      kind: "parse_error",
      uuid: `parse-error-${line.uuid || "unknown"}`,
      timestamp: line.timestamp || "",
      lineNumber: 0,
      rawLine: JSON.stringify(line.message.content).slice(0, 500),
      errorType: "invalid_structure",
      errorDetails: `Assistant message content is ${typeof line.message.content}, expected array`,
    });
    return currentAssistant;
  }
  const current = currentAssistant ?? createAssistantTurn(line);
  processAssistantLine(line, current, toolResults);
  return current;
}

function handleSystemLine(
  line: RawLine,
  currentAssistant: AssistantTurn | null,
  turns: Turn[],
): null {
  flushAssistant(currentAssistant, turns);
  if (!line.message) return null;
  const text = typeof line.message.content === "string" ? line.message.content : "";
  turns.push({
    kind: "system",
    uuid: line.uuid || "",
    timestamp: line.timestamp || "",
    text,
  });
  return null;
}

export function buildTurns(lines: RawLine[], parseErrors: ParseErrorTurn[] = []): Turn[] {
  const displayable = lines.filter(isDisplayableLine);
  const toolResults = collectToolResults(displayable);

  const turns: Turn[] = [];
  let currentAssistant: AssistantTurn | null = null;
  const structureErrors: ParseErrorTurn[] = [];

  for (const line of displayable) {
    if (line.type === "user") {
      currentAssistant = handleUserLine(line, currentAssistant, turns);
    } else if (line.type === "assistant") {
      currentAssistant = handleAssistantLine(line, currentAssistant, toolResults, structureErrors);
    } else if (line.type === "system") {
      currentAssistant = handleSystemLine(line, currentAssistant, turns);
    }
  }

  flushAssistant(currentAssistant, turns);

  const allErrors = [...parseErrors, ...structureErrors];
  if (allErrors.length > 0) {
    turns.push(...allErrors);
  }

  return turns;
}

function extractToolResult(tr: RawToolResultBlock): {
  text: string;
  images: ToolResultImage[];
} {
  if (typeof tr.content === "string") return { text: tr.content, images: [] };
  if (Array.isArray(tr.content)) {
    const textParts: string[] = [];
    const images: ToolResultImage[] = [];
    for (const c of tr.content) {
      if (c.type === "text" && "text" in c) {
        textParts.push(c.text);
      } else if (c.type === "image" && "source" in c) {
        images.push({
          mediaType: c.source.media_type,
          data: c.source.data,
        });
      }
    }
    return { text: textParts.join("\n"), images };
  }
  return { text: "", images: [] };
}
