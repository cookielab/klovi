import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AssistantTurn,
  Attachment,
  Session,
  SystemTurn,
  ToolCallWithResult,
  ToolResultImage,
  Turn,
  UserTurn,
} from "../../shared/types.ts";
import { parseCommandMessage } from "./command-message.ts";
import type { RawContentBlock, RawLine, RawToolResultBlock } from "./types.ts";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

export async function parseSession(sessionId: string, encodedPath: string): Promise<Session> {
  const rawLines = await readJsonlLines(join(PROJECTS_DIR, encodedPath, `${sessionId}.jsonl`));

  const subAgentMap = extractSubAgentMap(rawLines);
  const turns = buildTurns(rawLines);

  // Attach subAgentId to Task tool calls
  for (const turn of turns) {
    if (turn.kind !== "assistant") continue;
    for (const call of turn.toolCalls) {
      if (call.name === "Task") {
        const agentId = subAgentMap.get(call.toolUseId);
        if (agentId) {
          call.subAgentId = agentId;
        }
      }
    }
  }

  return {
    sessionId,
    project: encodedPath,
    turns,
  };
}

export async function parseSubAgentSession(
  sessionId: string,
  encodedPath: string,
  agentId: string,
): Promise<Session> {
  const filePath = join(
    PROJECTS_DIR,
    encodedPath,
    sessionId,
    "subagents",
    `agent-${agentId}.jsonl`,
  );

  let rawLines: RawLine[];
  try {
    rawLines = await readJsonlLines(filePath);
  } catch {
    return { sessionId, project: encodedPath, turns: [] };
  }

  const subAgentMap = extractSubAgentMap(rawLines);
  const turns = buildTurns(rawLines);

  for (const turn of turns) {
    if (turn.kind !== "assistant") continue;
    for (const call of turn.toolCalls) {
      if (call.name === "Task") {
        const nestedAgentId = subAgentMap.get(call.toolUseId);
        if (nestedAgentId) {
          call.subAgentId = nestedAgentId;
        }
      }
    }
  }

  return { sessionId, project: encodedPath, turns };
}

const AGENT_ID_RE = /agentId:\s*(\w+)/;

export function extractSubAgentMap(lines: RawLine[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    // Method 1: progress events with agent_progress data (foreground agents)
    if (
      line.type === "progress" &&
      line.parentToolUseID &&
      line.data?.type === "agent_progress" &&
      line.data.agentId
    ) {
      map.set(line.parentToolUseID, line.data.agentId);
    }

    // Method 2: tool_result content containing "agentId: <id>" (background agents)
    if (line.type === "user" && line.message && Array.isArray(line.message.content)) {
      for (const block of line.message.content) {
        if (block.type !== "tool_result") continue;
        const tr = block as RawToolResultBlock;
        const text =
          typeof tr.content === "string"
            ? tr.content
            : Array.isArray(tr.content)
              ? tr.content
                  .filter((c) => c.type === "text" && "text" in c)
                  .map((c) => ("text" in c ? c.text : ""))
                  .join("")
              : "";
        const match = AGENT_ID_RE.exec(text);
        if (match?.[1]) {
          map.set(tr.tool_use_id, match[1]);
        }
      }
    }
  }
  return map;
}

async function readJsonlLines(filePath: string): Promise<RawLine[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as RawLine;
      } catch {
        return null;
      }
    })
    .filter((l): l is RawLine => l !== null);
}

export function buildTurns(lines: RawLine[]): Turn[] {
  // Filter out non-displayable lines
  const displayable = lines.filter((l) => {
    if (l.type === "progress") return false;
    if (l.type === "file-history-snapshot") return false;
    if (l.type === "summary") return false;
    if (l.isMeta) return false;
    if (!l.message) return false;
    return true;
  });

  // Collect tool_result blocks from user messages, indexed by tool_use_id
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

  const turns: Turn[] = [];
  let currentAssistant: AssistantTurn | null = null;

  for (const line of displayable) {
    if (line.type === "user" && line.message) {
      const content = line.message.content;

      // Skip user messages that are only tool_results (they're matched to assistant tool calls)
      // Don't flush the current assistant - the next assistant line continues the same turn
      if (Array.isArray(content)) {
        const hasOnlyToolResults = content.every((b) => b.type === "tool_result");
        if (hasOnlyToolResults) continue;
      }

      // Flush any pending assistant turn (real user message breaks the assistant turn)
      if (currentAssistant) {
        turns.push(currentAssistant);
        currentAssistant = null;
      }

      // Extract user text and attachments
      let text = "";
      const attachments: Attachment[] = [];
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        const textBlocks = content.filter((b) => b.type === "text");
        text = textBlocks.map((b) => ("text" in b ? b.text : "")).join("\n");

        for (const block of content) {
          if (block.type === "image" && "source" in block) {
            attachments.push({
              type: "image",
              mediaType: (block as { source: { media_type: string } }).source.media_type,
            });
          }
        }
      }

      // Skip command/system/internal messages
      if (
        text.startsWith("<local-command") ||
        text.startsWith("<command-name") ||
        text.startsWith("<task-notification") ||
        text.startsWith("<system-reminder")
      ) {
        continue;
      }

      const command = parseCommandMessage(text);
      const userTurn: UserTurn = {
        kind: "user",
        uuid: line.uuid || "",
        timestamp: line.timestamp || "",
        text: command ? command.args : text,
        command: command ?? undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      turns.push(userTurn);
    } else if (line.type === "assistant" && line.message) {
      const content = line.message.content;
      if (!Array.isArray(content)) continue;

      // Start new assistant turn if needed
      if (!currentAssistant) {
        currentAssistant = {
          kind: "assistant",
          uuid: line.uuid || "",
          timestamp: line.timestamp || "",
          model: line.message.model || "",
          thinkingBlocks: [],
          textBlocks: [],
          toolCalls: [],
        };
      }

      // Extract token usage and stop reason (last message wins)
      const msg = line.message;
      if (msg.usage) {
        currentAssistant.usage = {
          inputTokens: msg.usage.input_tokens ?? 0,
          outputTokens: msg.usage.output_tokens ?? 0,
          cacheReadTokens: msg.usage.cache_read_input_tokens,
          cacheCreationTokens: msg.usage.cache_creation_input_tokens,
        };
      }
      if (msg.stop_reason) {
        currentAssistant.stopReason = msg.stop_reason;
      }

      // Process content blocks
      for (const block of content as RawContentBlock[]) {
        if (block.type === "thinking" && "thinking" in block) {
          currentAssistant.thinkingBlocks.push({
            text: block.thinking,
          });
        } else if (block.type === "text" && "text" in block) {
          if (block.text.trim()) {
            currentAssistant.textBlocks.push(block.text);
          }
        } else if (block.type === "tool_use" && "id" in block) {
          const result = toolResults.get(block.id);
          const toolCall: ToolCallWithResult = {
            toolUseId: block.id,
            name: block.name,
            input: block.input,
            result: result?.content ?? "",
            isError: result?.isError ?? false,
          };
          if (result?.images && result.images.length > 0) {
            toolCall.resultImages = result.images;
          }
          currentAssistant.toolCalls.push(toolCall);
        }
      }
    } else if (line.type === "system" && line.message) {
      if (currentAssistant) {
        turns.push(currentAssistant);
        currentAssistant = null;
      }
      const content = line.message.content;
      const text = typeof content === "string" ? content : "";
      const systemTurn: SystemTurn = {
        kind: "system",
        uuid: line.uuid || "",
        timestamp: line.timestamp || "",
        text,
      };
      turns.push(systemTurn);
    }
  }

  // Flush last assistant turn
  if (currentAssistant) {
    turns.push(currentAssistant);
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
