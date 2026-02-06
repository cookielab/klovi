import { join } from "node:path";
import { homedir } from "node:os";
import type {
  Session,
  Turn,
  UserTurn,
  AssistantTurn,
  SystemTurn,
  Attachment,
} from "../../shared/types.ts";
import type {
  RawLine,
  RawContentBlock,
  RawToolResultBlock,
} from "./types.ts";
import { parseCommandMessage } from "./command-message.ts";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

export async function parseSession(
  sessionId: string,
  encodedPath: string
): Promise<Session> {
  const filePath = join(PROJECTS_DIR, encodedPath, `${sessionId}.jsonl`);
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawLines = text
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

  const turns = buildTurns(rawLines);

  return {
    sessionId,
    project: encodedPath,
    turns,
  };
}

function buildTurns(lines: RawLine[]): Turn[] {
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
    { content: string; isError: boolean }
  >();
  for (const line of displayable) {
    if (line.type !== "user" || !line.message) continue;
    const content = line.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "tool_result") {
        const tr = block as RawToolResultBlock;
        const text = extractToolResultText(tr);
        toolResults.set(tr.tool_use_id, {
          content: text,
          isError: tr.is_error ?? false,
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
        const hasOnlyToolResults = content.every(
          (b) => b.type === "tool_result"
        );
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
          currentAssistant.toolCalls.push({
            toolUseId: block.id,
            name: block.name,
            input: block.input,
            result: result?.content ?? "",
            isError: result?.isError ?? false,
          });
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

function extractToolResultText(tr: RawToolResultBlock): string {
  if (typeof tr.content === "string") return tr.content;
  if (Array.isArray(tr.content)) {
    return tr.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}
