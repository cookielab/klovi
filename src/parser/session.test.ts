import { describe, expect, test } from "bun:test";
import {
  buildTurns,
  extractSlug,
  extractSubAgentMap,
  findImplSessionId,
  findPlanSessionId,
} from "../plugins/claude-code/parser.ts";
import type { AssistantTurn, SessionSummary, SystemTurn, UserTurn } from "../shared/types.ts";
import type { RawLine } from "./types.ts";

function line(overrides: Partial<RawLine> & { type: string }): RawLine {
  return {
    uuid: `uuid-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: "2025-01-15T10:00:00Z",
    ...overrides,
  } as RawLine;
}

describe("buildTurns", () => {
  test("basic user text → UserTurn", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "Hello world" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.kind).toBe("user");
    expect((turns[0] as UserTurn).text).toBe("Hello world");
  });

  test("basic assistant text → AssistantTurn with text contentBlock", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "Here is my response." }],
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.kind).toBe("assistant");
    expect(turn.contentBlocks).toHaveLength(1);
    expect(turn.contentBlocks[0]).toEqual({ type: "text", text: "Here is my response." });
    expect(turn.model).toBe("claude-sonnet-4-5-20250929");
  });

  test("thinking block extraction", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [
            { type: "thinking", thinking: "Let me think about this..." },
            { type: "text", text: "My answer." },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as AssistantTurn;
    expect(turn.contentBlocks).toHaveLength(2);
    expect(turn.contentBlocks[0]).toEqual({
      type: "thinking",
      block: { text: "Let me think about this..." },
    });
    expect(turn.contentBlocks[1]).toEqual({ type: "text", text: "My answer." });
  });

  test("tool use + tool result matching by id", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "Read",
              input: { file_path: "/tmp/test.ts" },
            },
          ],
        },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_1",
              content: "file contents here",
            },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.contentBlocks).toHaveLength(1);
    const call = turn.contentBlocks[0];
    expect(call?.type).toBe("tool_call");
    if (call?.type === "tool_call") {
      expect(call.call.name).toBe("Read");
      expect(call.call.result).toBe("file contents here");
      expect(call.call.isError).toBe(false);
    }
  });

  test("tool result is_error: true → isError: true", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [
            {
              type: "tool_use",
              id: "tool_err",
              name: "Bash",
              input: { command: "exit 1" },
            },
          ],
        },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_err",
              content: "command failed",
              is_error: true,
            },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as AssistantTurn;
    const call = turn.contentBlocks[0];
    expect(call?.type).toBe("tool_call");
    if (call?.type === "tool_call") {
      expect(call.call.isError).toBe(true);
      expect(call.call.result).toBe("command failed");
    }
  });

  test("image attachment in user message → Attachment", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Look at this screenshot" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "iVBOR...",
              },
            },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as UserTurn;
    expect(turn.attachments).toHaveLength(1);
    expect(turn.attachments?.[0]?.type).toBe("image");
    expect(turn.attachments?.[0]?.mediaType).toBe("image/png");
  });

  test("command message parsing", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content:
            "<command-message>commit</command-message><command-name>/commit</command-name><command-args>fix: resolve bug</command-args>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as UserTurn;
    expect(turn.command).toBeDefined();
    expect(turn.command?.name).toBe("/commit");
    expect(turn.text).toBe("fix: resolve bug");
  });

  test("filtering: progress, file-history-snapshot, summary, isMeta lines skipped", () => {
    const lines: RawLine[] = [
      line({ type: "progress", message: { role: "assistant", content: "" } }),
      line({
        type: "file-history-snapshot",
        message: { role: "assistant", content: "" },
      }),
      line({ type: "summary", message: { role: "assistant", content: "" } }),
      line({
        type: "user",
        isMeta: true,
        message: { role: "user", content: "meta" },
      }),
      line({
        type: "user",
        message: { role: "user", content: "Visible message" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    expect((turns[0] as UserTurn).text).toBe("Visible message");
  });

  test("bash-input user message → UserTurn with bashInput", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<bash-input>bun run dev</bash-input>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.kind).toBe("user");
    expect(turn.bashInput).toBe("bun run dev");
    expect(turn.text).toBe("");
  });

  test("ide_opened_file user message → UserTurn with ideOpenedFile (path extracted)", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content:
            "<ide_opened_file>The user opened the file /Users/dev/project/.env in the IDE. This may or may not be related to the current task.</ide_opened_file>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.kind).toBe("user");
    expect(turn.ideOpenedFile).toBe("/Users/dev/project/.env");
    expect(turn.text).toBe("");
  });

  test("ide_opened_file with unrecognized format renders as plain text", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<ide_opened_file>Some unexpected format</ide_opened_file>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.kind).toBe("user");
    expect(turn.ideOpenedFile).toBeUndefined();
    expect(turn.text).toBe("<ide_opened_file>Some unexpected format</ide_opened_file>");
  });

  test("bash-stdout only → UserTurn with bashStdout, bashStderr undefined", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<bash-stdout>hello world</bash-stdout>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.kind).toBe("user");
    expect(turn.bashStdout).toBe("hello world");
    expect(turn.bashStderr).toBeUndefined();
    expect(turn.text).toBe("");
  });

  test("bash-stdout + bash-stderr → both fields set", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content:
            "<bash-stdout>To github.com:repo.git</bash-stdout><bash-stderr>warning: something</bash-stderr>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashStdout).toBe("To github.com:repo.git");
    expect(turn.bashStderr).toBe("warning: something");
    expect(turn.text).toBe("");
  });

  test("empty bash-stdout + empty bash-stderr → both empty strings", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<bash-stdout></bash-stdout><bash-stderr></bash-stderr>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashStdout).toBe("");
    expect(turn.bashStderr).toBe("");
    expect(turn.text).toBe("");
  });

  test("multi-line bash-stdout content", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<bash-stdout>line1\nline2\nline3</bash-stdout>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashStdout).toBe("line1\nline2\nline3");
    expect(turn.text).toBe("");
  });

  test("bash-input followed by bash-stdout merges into one turn", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "<bash-input>ls -la</bash-input>" },
      }),
      line({
        type: "user",
        message: { role: "user", content: "<bash-stdout>total 42</bash-stdout>" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashInput).toBe("ls -la");
    expect(turn.bashStdout).toBe("total 42");
    expect(turn.bashStderr).toBeUndefined();
  });

  test("bash-input followed by bash-stdout+stderr merges with all fields", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "<bash-input>npm install</bash-input>" },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content:
            "<bash-stdout>added 5 packages</bash-stdout><bash-stderr>warn deprecated</bash-stderr>",
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashInput).toBe("npm install");
    expect(turn.bashStdout).toBe("added 5 packages");
    expect(turn.bashStderr).toBe("warn deprecated");
  });

  test("standalone bash-input followed by assistant turn stays separate", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "<bash-input>echo hi</bash-input>" },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "OK" }],
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(2);
    const userTurn = turns[0] as UserTurn;
    expect(userTurn.bashInput).toBe("echo hi");
    expect(userTurn.bashStdout).toBeUndefined();
  });

  test("standalone bash-stdout stays separate", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "<bash-stdout>some output</bash-stdout>" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as UserTurn;
    expect(turn.bashStdout).toBe("some output");
    expect(turn.bashInput).toBeUndefined();
  });

  test("bash-input followed by non-bash user turn doesn't merge", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "<bash-input>pwd</bash-input>" },
      }),
      line({
        type: "user",
        message: { role: "user", content: "Hello world" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(2);
    const bashTurn = turns[0] as UserTurn;
    expect(bashTurn.bashInput).toBe("pwd");
    expect(bashTurn.bashStdout).toBeUndefined();
    const textTurn = turns[1] as UserTurn;
    expect(textTurn.text).toBe("Hello world");
  });

  test("system-reminder user messages skipped", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: "<system-reminder>you are a helpful assistant</system-reminder>",
        },
      }),
      line({
        type: "user",
        message: { role: "user", content: "Real question" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    expect((turns[0] as UserTurn).text).toBe("Real question");
  });

  test("tool-result-only user messages don't break assistant turn grouping", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [
            { type: "text", text: "I'll read the file." },
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { file_path: "/a.ts" },
            },
          ],
        },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "contents" }],
        },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "Now I'll continue." }],
        },
      }),
    ];
    const turns = buildTurns(lines);
    // Should merge into one assistant turn
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.contentBlocks.map((b) => b.type)).toEqual(["text", "tool_call", "text"]);
  });

  test("contentBlocks preserve chronological order of thinking, text, and tool calls", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [
            { type: "thinking", thinking: "Let me think..." },
            { type: "text", text: "I'll read the file." },
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { file_path: "/a.ts" },
            },
          ],
        },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "contents" }],
        },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [
            { type: "thinking", thinking: "Now I know the file contents." },
            { type: "text", text: "The file contains..." },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.contentBlocks).toHaveLength(5);
    expect(turn.contentBlocks.map((b) => b.type)).toEqual([
      "thinking",
      "text",
      "tool_call",
      "thinking",
      "text",
    ]);
  });

  test("system turn extraction", () => {
    const lines: RawLine[] = [
      line({
        type: "system",
        message: { role: "user", content: "System initialized" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.kind).toBe("system");
    expect((turns[0] as SystemTurn).text).toBe("System initialized");
  });

  test("token usage extraction from assistant message", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "Done." }],
          usage: {
            input_tokens: 1500,
            output_tokens: 300,
            cache_read_input_tokens: 1200,
            cache_creation_input_tokens: 100,
          },
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as AssistantTurn;
    expect(turn.usage).toBeDefined();
    expect(turn.usage?.inputTokens).toBe(1500);
    expect(turn.usage?.outputTokens).toBe(300);
    expect(turn.usage?.cacheReadTokens).toBe(1200);
    expect(turn.usage?.cacheCreationTokens).toBe(100);
  });

  test("stop reason extraction", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "All done." }],
          stop_reason: "end_turn",
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as AssistantTurn;
    expect(turn.stopReason).toBe("end_turn");
  });

  test("image in tool result → resultImages", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [
            {
              type: "tool_use",
              id: "t_img",
              name: "Read",
              input: { file_path: "/screenshot.png" },
            },
          ],
        },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t_img",
              content: [
                { type: "text", text: "Image read successfully" },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: "AAAA",
                  },
                },
              ],
            },
          ],
        },
      }),
    ];
    const turns = buildTurns(lines);
    const turn = turns[0] as AssistantTurn;
    const call = turn.contentBlocks[0];
    expect(call?.type).toBe("tool_call");
    if (call?.type === "tool_call") {
      expect(call.call.result).toBe("Image read successfully");
      expect(call.call.resultImages).toHaveLength(1);
      expect(call.call.resultImages?.[0]?.mediaType).toBe("image/png");
      expect(call.call.resultImages?.[0]?.data).toBe("AAAA");
    }
  });

  test("multiple assistant lines merge into one turn", () => {
    const lines: RawLine[] = [
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "thinking", thinking: "Hmm..." }],
        },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "First part." }],
        },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "Second part." }],
        },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.contentBlocks).toHaveLength(3);
    expect(turn.contentBlocks.map((b) => b.type)).toEqual(["thinking", "text", "text"]);
  });

  test("empty/malformed lines handled gracefully", () => {
    const lines: RawLine[] = [
      { type: "user" } as RawLine, // no message
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: "just a string", // not an array
        },
      }),
      line({
        type: "user",
        message: { role: "user", content: "After malformed" },
      }),
    ];
    const turns = buildTurns(lines);
    expect(turns).toHaveLength(2);
    expect((turns[0] as UserTurn).text).toBe("After malformed");
    expect(turns[1]?.kind).toBe("parse_error");
    const parseError = turns[1] as import("../shared/types.ts").ParseErrorTurn;
    expect(parseError.errorType).toBe("invalid_structure");
    expect(parseError.rawLine).toContain("just a string");
  });

  test("parse errors from readJsonlLines are appended to turns", () => {
    const parseErrors: import("../shared/types.ts").ParseErrorTurn[] = [
      {
        kind: "parse_error",
        uuid: "parse-error-line-5",
        timestamp: "",
        lineNumber: 5,
        rawLine: "{invalid json",
        errorType: "json_parse",
        errorDetails: "Unexpected token",
      },
    ];
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "Hello" },
      }),
    ];
    const turns = buildTurns(lines, parseErrors);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.kind).toBe("user");
    expect(turns[1]?.kind).toBe("parse_error");
    const error = turns[1] as import("../shared/types.ts").ParseErrorTurn;
    expect(error.lineNumber).toBe(5);
    expect(error.rawLine).toBe("{invalid json");
    expect(error.errorType).toBe("json_parse");
  });

  test("multiple parse errors are all preserved", () => {
    const parseErrors: import("../shared/types.ts").ParseErrorTurn[] = [
      {
        kind: "parse_error",
        uuid: "parse-error-line-1",
        timestamp: "",
        lineNumber: 1,
        rawLine: "not json at all",
        errorType: "json_parse",
      },
      {
        kind: "parse_error",
        uuid: "parse-error-line-3",
        timestamp: "",
        lineNumber: 3,
        rawLine: "{broken",
        errorType: "json_parse",
      },
    ];
    const turns = buildTurns([], parseErrors);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.kind).toBe("parse_error");
    expect(turns[1]?.kind).toBe("parse_error");
  });
});

describe("extractSubAgentMap", () => {
  test("extracts agentId from agent_progress events (foreground agents)", () => {
    const lines: RawLine[] = [
      line({
        type: "progress",
        parentToolUseID: "toolu_abc123",
        data: { type: "agent_progress", agentId: "a1b2c3d" },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.get("toolu_abc123")).toBe("a1b2c3d");
  });

  test("extracts agentId from tool_result text (background agents)", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_xyz789",
              content: [
                {
                  type: "text",
                  text: "Async agent launched successfully.\nagentId: a52c371 (internal ID)\nThe agent is working in the background.",
                },
              ],
            },
          ],
        },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.get("toolu_xyz789")).toBe("a52c371");
  });

  test("extracts agentId from plain string tool_result content", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_str1",
              content: "agentId: abc1234 (internal ID)",
            },
          ],
        },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.get("toolu_str1")).toBe("abc1234");
  });

  test("ignores progress events that are not agent_progress", () => {
    const lines: RawLine[] = [
      line({
        type: "progress",
        parentToolUseID: "some-uuid",
        data: { type: "hook_progress" },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.size).toBe(0);
  });

  test("ignores tool_results without agentId in text", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_nope",
              content: "file contents here, no agent id",
            },
          ],
        },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.size).toBe(0);
  });

  test("handles both foreground and background agents in same session", () => {
    const lines: RawLine[] = [
      line({
        type: "progress",
        parentToolUseID: "toolu_fg1",
        data: { type: "agent_progress", agentId: "afg0001" },
      }),
      line({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_bg1",
              content: "Async agent launched successfully.\nagentId: abg0002",
            },
          ],
        },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.size).toBe(2);
    expect(map.get("toolu_fg1")).toBe("afg0001");
    expect(map.get("toolu_bg1")).toBe("abg0002");
  });

  test("returns empty map when no sub-agents exist", () => {
    const lines: RawLine[] = [
      line({
        type: "user",
        message: { role: "user", content: "Hello" },
      }),
      line({
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "Hi!" }],
        },
      }),
    ];
    const map = extractSubAgentMap(lines);
    expect(map.size).toBe(0);
  });
});

describe("extractSlug", () => {
  test("returns slug from first line that has one", () => {
    const lines: RawLine[] = [
      line({ type: "user", slug: "prancy-pondering-deer" }),
      line({ type: "user", slug: "another-slug" }),
    ];
    expect(extractSlug(lines)).toBe("prancy-pondering-deer");
  });

  test("returns undefined when no lines have a slug", () => {
    const lines: RawLine[] = [line({ type: "user", message: { role: "user", content: "Hello" } })];
    expect(extractSlug(lines)).toBeUndefined();
  });
});

describe("findPlanSessionId", () => {
  const sessions: SessionSummary[] = [
    {
      sessionId: "plan-session-1",
      timestamp: "2025-01-15T09:00:00Z",
      slug: "prancy-pondering-deer",
      firstMessage: "Help me plan something",
      model: "claude-opus-4-6",
      gitBranch: "main",
    },
    {
      sessionId: "impl-session-2",
      timestamp: "2025-01-15T10:00:00Z",
      slug: "prancy-pondering-deer",
      firstMessage: "Implement the following plan",
      model: "claude-opus-4-6",
      gitBranch: "main",
    },
  ];

  test("returns planning session ID when first user turn starts with plan prefix", () => {
    const turns = buildTurns([
      line({
        type: "user",
        message: { role: "user", content: "Implement the following plan:\n\n# My Plan" },
      }),
    ]);
    const result = findPlanSessionId(turns, "prancy-pondering-deer", sessions, "impl-session-2");
    expect(result).toBe("plan-session-1");
  });

  test("returns undefined when first user turn is a regular message", () => {
    const turns = buildTurns([
      line({
        type: "user",
        message: { role: "user", content: "Hello, help me with something" },
      }),
    ]);
    const result = findPlanSessionId(turns, "prancy-pondering-deer", sessions, "impl-session-2");
    expect(result).toBeUndefined();
  });

  test("returns undefined when no session with matching slug is found", () => {
    const turns = buildTurns([
      line({
        type: "user",
        message: { role: "user", content: "Implement the following plan:\n\n# Plan" },
      }),
    ]);
    const result = findPlanSessionId(turns, "nonexistent-slug", sessions, "impl-session-2");
    expect(result).toBeUndefined();
  });

  test("returns undefined when slug is undefined", () => {
    const turns = buildTurns([
      line({
        type: "user",
        message: { role: "user", content: "Implement the following plan:\n\n# Plan" },
      }),
    ]);
    const result = findPlanSessionId(turns, undefined, sessions, "impl-session-2");
    expect(result).toBeUndefined();
  });

  test("skips status-notice turns like [Request interrupted]", () => {
    const turns = buildTurns([
      line({
        type: "user",
        message: { role: "user", content: "[Request interrupted by user for tool use]" },
      }),
      line({
        type: "user",
        message: { role: "user", content: "Implement the following plan:\n\n# My Plan" },
      }),
    ]);
    const result = findPlanSessionId(turns, "prancy-pondering-deer", sessions, "impl-session-2");
    expect(result).toBe("plan-session-1");
  });
});

describe("findImplSessionId", () => {
  const sessions: SessionSummary[] = [
    {
      sessionId: "plan-session-1",
      timestamp: "2025-01-15T09:00:00Z",
      slug: "prancy-pondering-deer",
      firstMessage: "Help me plan something",
      model: "claude-opus-4-6",
      gitBranch: "main",
    },
    {
      sessionId: "impl-session-2",
      timestamp: "2025-01-15T10:00:00Z",
      slug: "prancy-pondering-deer",
      firstMessage: "Implement the following plan",
      model: "claude-opus-4-6",
      gitBranch: "main",
    },
  ];

  test("returns impl session ID when slug-matched session with plan prefix exists", () => {
    const result = findImplSessionId("prancy-pondering-deer", sessions, "plan-session-1");
    expect(result).toBe("impl-session-2");
  });

  test("returns undefined when no session with matching slug exists", () => {
    const result = findImplSessionId("nonexistent-slug", sessions, "plan-session-1");
    expect(result).toBeUndefined();
  });

  test("returns undefined when slug is undefined", () => {
    const result = findImplSessionId(undefined, sessions, "plan-session-1");
    expect(result).toBeUndefined();
  });

  test("returns undefined when no slug-matched session starts with plan prefix", () => {
    const noImplSessions: SessionSummary[] = [
      {
        sessionId: "session-a",
        timestamp: "2025-01-15T09:00:00Z",
        slug: "some-slug",
        firstMessage: "Help me plan something",
        model: "claude-opus-4-6",
        gitBranch: "main",
      },
      {
        sessionId: "session-b",
        timestamp: "2025-01-15T10:00:00Z",
        slug: "some-slug",
        firstMessage: "Another regular session",
        model: "claude-opus-4-6",
        gitBranch: "main",
      },
    ];
    const result = findImplSessionId("some-slug", noImplSessions, "session-a");
    expect(result).toBeUndefined();
  });
});
