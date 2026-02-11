import { describe, expect, test } from "bun:test";
import type { AssistantTurn, SystemTurn, UserTurn } from "../../shared/types.ts";
import { buildTurns, extractSubAgentMap } from "./session.ts";
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
    expect(turns[0]!.kind).toBe("user");
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
    const call = turn.contentBlocks[0]!;
    expect(call.type).toBe("tool_call");
    if (call.type === "tool_call") {
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
    const call = turn.contentBlocks[0]!;
    expect(call.type).toBe("tool_call");
    if (call.type === "tool_call") {
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
    expect(turn.attachments![0]!.type).toBe("image");
    expect(turn.attachments![0]!.mediaType).toBe("image/png");
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
    expect(turn.command!.name).toBe("/commit");
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
    expect(turns[0]!.kind).toBe("system");
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
    expect(turn.usage!.inputTokens).toBe(1500);
    expect(turn.usage!.outputTokens).toBe(300);
    expect(turn.usage!.cacheReadTokens).toBe(1200);
    expect(turn.usage!.cacheCreationTokens).toBe(100);
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
    const call = turn.contentBlocks[0]!;
    expect(call.type).toBe("tool_call");
    if (call.type === "tool_call") {
      expect(call.call.result).toBe("Image read successfully");
      expect(call.call.resultImages).toHaveLength(1);
      expect(call.call.resultImages![0]!.mediaType).toBe("image/png");
      expect(call.call.resultImages![0]!.data).toBe("AAAA");
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
    expect(turns).toHaveLength(1);
    expect((turns[0] as UserTurn).text).toBe("After malformed");
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
