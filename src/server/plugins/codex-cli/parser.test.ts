import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantTurn } from "../../../shared/types.ts";
import { setCodexCliDir } from "../../config.ts";
import { buildCodexTurns, type CodexEvent, loadCodexSession } from "./parser.ts";

const testDir = join(tmpdir(), `klovi-codex-parser-test-${Date.now()}`);

function writeSession(
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): string {
  const dir = join(testDir, "sessions", "openai", "2025-01-15");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
  writeFileSync(filePath, lines.join("\n"));
  return filePath;
}

const baseMeta = {
  uuid: "test-uuid",
  name: "Test session",
  cwd: "/Users/dev/project",
  timestamps: { created: 1706000000, updated: 1706001000 },
  model: "o4-mini",
  provider_id: "openai",
};

beforeEach(() => {
  mkdirSync(join(testDir, "sessions"), { recursive: true });
  setCodexCliDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("buildCodexTurns", () => {
  test("builds assistant turn with text from agent_message", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "Hello, I can help!" } },
      { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 50 } },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.kind).toBe("assistant");
    expect(assistant.model).toBe("o4-mini");
    expect(assistant.contentBlocks).toHaveLength(1);
    expect(assistant.contentBlocks[0]!.type).toBe("text");
    if (assistant.contentBlocks[0]!.type === "text") {
      expect(assistant.contentBlocks[0]!.text).toBe("Hello, I can help!");
    }
    expect(assistant.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: undefined,
    });
  });

  test("builds thinking content from reasoning items", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "reasoning", text: "Let me think about this..." } },
      { type: "item.completed", item: { type: "agent_message", text: "Here is my answer." } },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(2);
    expect(assistant.contentBlocks[0]!.type).toBe("thinking");
    if (assistant.contentBlocks[0]!.type === "thinking") {
      expect(assistant.contentBlocks[0]!.block.text).toBe("Let me think about this...");
    }
    expect(assistant.contentBlocks[1]!.type).toBe("text");
  });

  test("builds tool call from command_execution", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "ls -la",
          aggregated_output: "total 42\ndrwxr-xr-x 5 user user 160 Jan 15 00:00 .",
          exit_code: 0,
        },
      },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(1);
    const block = assistant.contentBlocks[0]!;
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("command_execution");
      expect(block.call.input).toEqual({ command: "ls -la" });
      expect(block.call.result).toContain("total 42");
      expect(block.call.isError).toBe(false);
    }
  });

  test("marks failed command_execution as error", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "false",
          aggregated_output: "",
          exit_code: 1,
        },
      },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    if (block.type === "tool_call") {
      expect(block.call.isError).toBe(true);
    }
  });

  test("builds tool call from file_change", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "file_change",
          changes: [
            { path: "src/main.ts", kind: "edit" },
            { path: "src/utils.ts", kind: "create" },
          ],
        },
      },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("file_change");
      expect(block.call.input).toEqual({
        changes: [
          { path: "src/main.ts", kind: "edit" },
          { path: "src/utils.ts", kind: "create" },
        ],
      });
      expect(block.call.isError).toBe(false);
    }
  });

  test("builds tool call from mcp_tool_call", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          server: "my-server",
          tool: "search_docs",
          arguments: { query: "authentication" },
          result: "Found 3 results",
        },
      },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("search_docs");
      expect(block.call.input).toEqual({ query: "authentication" });
      expect(block.call.result).toBe("Found 3 results");
    }
  });

  test("builds tool call from web_search", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: { type: "web_search", query: "how to use bun test" },
      },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("web_search");
      expect(block.call.input).toEqual({ query: "how to use bun test" });
    }
  });

  test("handles multiple turns", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "First response" } },
      { type: "turn.completed", usage: { input_tokens: 50, output_tokens: 20 } },
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "Second response" } },
      { type: "turn.completed", usage: { input_tokens: 80, output_tokens: 30 } },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    // First turn is assistant, then user (empty, from second turn.started), then assistant
    expect(turns).toHaveLength(3);
    expect(turns[0]!.kind).toBe("assistant");
    expect(turns[1]!.kind).toBe("user");
    expect(turns[2]!.kind).toBe("assistant");

    const first = turns[0] as AssistantTurn;
    expect(first.contentBlocks[0]!.type).toBe("text");
    if (first.contentBlocks[0]!.type === "text") {
      expect(first.contentBlocks[0]!.text).toBe("First response");
    }
  });

  test("captures usage from turn.completed with cached tokens", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "Response" } },
      {
        type: "turn.completed",
        usage: { input_tokens: 200, output_tokens: 100, cached_input_tokens: 50 },
      },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    const assistant = turns[0] as AssistantTurn;
    expect(assistant.usage).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 50,
    });
  });

  test("handles mixed content blocks in a single turn", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "reasoning", text: "Thinking..." } },
      { type: "item.completed", item: { type: "agent_message", text: "Let me check." } },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat file.ts",
          aggregated_output: "content",
          exit_code: 0,
        },
      },
      { type: "item.completed", item: { type: "agent_message", text: "Here are the results." } },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(4);
    expect(assistant.contentBlocks[0]!.type).toBe("thinking");
    expect(assistant.contentBlocks[1]!.type).toBe("text");
    expect(assistant.contentBlocks[2]!.type).toBe("tool_call");
    expect(assistant.contentBlocks[3]!.type).toBe("text");
  });

  test("returns empty turns for empty events", () => {
    const turns = buildCodexTurns([], "o4-mini", "2025-01-15T00:00:00Z");
    expect(turns).toEqual([]);
  });
});

describe("loadCodexSession", () => {
  test("loads and parses a full session file", async () => {
    writeSession("test-uuid", baseMeta, [
      { type: "thread.started" },
      { type: "turn.started" },
      { type: "item.completed", item: { type: "reasoning", text: "Let me analyze..." } },
      { type: "item.completed", item: { type: "agent_message", text: "I found the issue." } },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "git diff",
          aggregated_output: "+new line",
          exit_code: 0,
        },
      },
      { type: "turn.completed", usage: { input_tokens: 300, output_tokens: 150 } },
    ]);

    const session = await loadCodexSession("/Users/dev/project", "test-uuid");

    expect(session.sessionId).toBe("test-uuid");
    expect(session.pluginId).toBe("codex-cli");
    expect(session.turns).toHaveLength(1);

    const assistant = session.turns[0] as AssistantTurn;
    expect(assistant.kind).toBe("assistant");
    expect(assistant.model).toBe("o4-mini");
    expect(assistant.contentBlocks).toHaveLength(3);
    expect(assistant.contentBlocks[0]!.type).toBe("thinking");
    expect(assistant.contentBlocks[1]!.type).toBe("text");
    expect(assistant.contentBlocks[2]!.type).toBe("tool_call");
  });

  test("returns empty session when file not found", async () => {
    const session = await loadCodexSession("/Users/dev/project", "nonexistent-uuid");

    expect(session.sessionId).toBe("nonexistent-uuid");
    expect(session.pluginId).toBe("codex-cli");
    expect(session.turns).toEqual([]);
  });

  test("loads session with file_change events", async () => {
    writeSession("fc-uuid", { ...baseMeta, uuid: "fc-uuid" }, [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "file_change",
          changes: [{ path: "src/index.ts", kind: "edit" }],
        },
      },
      { type: "turn.completed" },
    ]);

    const session = await loadCodexSession("/Users/dev/project", "fc-uuid");

    expect(session.turns).toHaveLength(1);
    const assistant = session.turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("file_change");
    }
  });

  test("loads session with mcp_tool_call events", async () => {
    writeSession("mcp-uuid", { ...baseMeta, uuid: "mcp-uuid" }, [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          server: "docs-server",
          tool: "search",
          arguments: { q: "test" },
          result: "Found results",
        },
      },
      { type: "turn.completed" },
    ]);

    const session = await loadCodexSession("/Users/dev/project", "mcp-uuid");

    const assistant = session.turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0]!;
    if (block.type === "tool_call") {
      expect(block.call.name).toBe("search");
      expect(block.call.input).toEqual({ q: "test" });
      expect(block.call.result).toBe("Found results");
    }
  });

  test("handles usage tracking across turns", async () => {
    writeSession("usage-uuid", { ...baseMeta, uuid: "usage-uuid" }, [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "Response 1" } },
      {
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 50, cached_input_tokens: 25 },
      },
    ]);

    const session = await loadCodexSession("/Users/dev/project", "usage-uuid");

    const assistant = session.turns[0] as AssistantTurn;
    expect(assistant.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 25,
    });
  });
});
