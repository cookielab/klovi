import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantTurn } from "../../shared/types.ts";
import { setCodexCliDir } from "../config.ts";
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

function writeNewFormatSession(
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): string {
  const dir = join(testDir, "sessions", "2026", "02", "18");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `rollout-2026-02-18-${uuid}.jsonl`);
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

const newBaseMeta = {
  type: "session_meta",
  timestamp: "2026-02-18T10:00:00.000Z",
  payload: {
    id: "new-test-uuid",
    cwd: "/Users/dev/project",
    timestamp: "2026-02-18T10:00:00.000Z",
    model_provider: "openai",
    model: "o4-mini",
    originator: "Codex Desktop",
  },
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

  test("uses deterministic generated UUIDs per parsed session", () => {
    const events: CodexEvent[] = [
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "First response" } },
      { type: "turn.completed" },
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "Second response" } },
      { type: "turn.completed" },
    ];

    const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

    expect(turns).toHaveLength(3);
    expect(turns[0]).toMatchObject({ kind: "assistant", uuid: "codex-assistant-1" });
    expect(turns[1]).toMatchObject({ kind: "user", uuid: "codex-user-1" });
    expect(turns[2]).toMatchObject({ kind: "assistant", uuid: "codex-assistant-2" });
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

describe("new envelope format", () => {
  describe("loadCodexSession", () => {
    test("loads session with new-format metadata and events", async () => {
      writeNewFormatSession("new-test-uuid", newBaseMeta, [
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:01.000Z",
          payload: { type: "task_started" },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:01.500Z",
          payload: { type: "user_message", message: "Fix the bug" },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:02.000Z",
          payload: { type: "agent_reasoning", text: "Let me think..." },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:03.000Z",
          payload: { type: "agent_message", message: "I found the issue." },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:04.000Z",
          payload: { type: "token_count", input_tokens: 200, output_tokens: 80 },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:05.000Z",
          payload: { type: "task_complete" },
        },
      ]);

      const session = await loadCodexSession("/Users/dev/project", "new-test-uuid");

      expect(session.sessionId).toBe("new-test-uuid");
      expect(session.pluginId).toBe("codex-cli");
      // First turn: user message, then assistant response
      expect(session.turns).toHaveLength(2);
      expect(session.turns[0]!.kind).toBe("user");
      if (session.turns[0]!.kind === "user") {
        expect(session.turns[0]!.text).toBe("Fix the bug");
      }

      const assistant = session.turns[1] as AssistantTurn;
      expect(assistant.kind).toBe("assistant");
      expect(assistant.model).toBe("o4-mini");
      expect(assistant.contentBlocks).toHaveLength(2);
      expect(assistant.contentBlocks[0]!.type).toBe("thinking");
      if (assistant.contentBlocks[0]!.type === "thinking") {
        expect(assistant.contentBlocks[0]!.block.text).toBe("Let me think...");
      }
      expect(assistant.contentBlocks[1]!.type).toBe("text");
      if (assistant.contentBlocks[1]!.type === "text") {
        expect(assistant.contentBlocks[1]!.text).toBe("I found the issue.");
      }
      expect(assistant.usage).toEqual({
        inputTokens: 200,
        outputTokens: 80,
        cacheReadTokens: undefined,
      });
    });

    test("loads new-format session with command execution", async () => {
      writeNewFormatSession(
        "cmd-uuid",
        { ...newBaseMeta, payload: { ...newBaseMeta.payload, id: "cmd-uuid" } },
        [
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:01.000Z",
            payload: { type: "task_started" },
          },
          {
            type: "response_item",
            timestamp: "2026-02-18T10:00:02.000Z",
            payload: {
              type: "function_call",
              name: "exec_command",
              call_id: "call_abc",
              arguments: '{"cmd":"ls -la","workdir":"/tmp"}',
            },
          },
          {
            type: "response_item",
            timestamp: "2026-02-18T10:00:02.500Z",
            payload: {
              type: "function_call_output",
              call_id: "call_abc",
              output: "file1.ts\nfile2.ts",
            },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:03.000Z",
            payload: { type: "token_count", input_tokens: 100, output_tokens: 50 },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:04.000Z",
            payload: { type: "task_complete" },
          },
        ],
      );

      const session = await loadCodexSession("/Users/dev/project", "cmd-uuid");

      expect(session.turns).toHaveLength(1);
      const assistant = session.turns[0] as AssistantTurn;
      expect(assistant.contentBlocks).toHaveLength(1);
      const block = assistant.contentBlocks[0]!;
      expect(block.type).toBe("tool_call");
      if (block.type === "tool_call") {
        expect(block.call.name).toBe("exec_command");
        expect(block.call.input).toEqual({ cmd: "ls -la", workdir: "/tmp" });
        expect(block.call.result).toBe("file1.ts\nfile2.ts");
        expect(block.call.isError).toBe(false);
      }
    });

    test("finds new-format file by session ID with rollout prefix", async () => {
      writeNewFormatSession(
        "rollout-uuid",
        { ...newBaseMeta, payload: { ...newBaseMeta.payload, id: "rollout-uuid" } },
        [
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:01.000Z",
            payload: { type: "task_started" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:02.000Z",
            payload: { type: "agent_message", message: "Hello!" },
          },
        ],
      );

      const session = await loadCodexSession("/Users/dev/project", "rollout-uuid");

      expect(session.turns).toHaveLength(1);
      const assistant = session.turns[0] as AssistantTurn;
      expect(assistant.contentBlocks[0]!.type).toBe("text");
    });

    test("returns empty session when new-format file not found", async () => {
      const session = await loadCodexSession("/Users/dev/project", "nonexistent-new-uuid");

      expect(session.sessionId).toBe("nonexistent-new-uuid");
      expect(session.turns).toEqual([]);
    });

    test("extracts tokens from nested info.last_token_usage in new format", async () => {
      writeNewFormatSession(
        "nested-tokens-uuid",
        { ...newBaseMeta, payload: { ...newBaseMeta.payload, id: "nested-tokens-uuid" } },
        [
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:01.000Z",
            payload: { type: "task_started" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:02.000Z",
            payload: { type: "agent_message", message: "Done!" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:03.000Z",
            payload: {
              type: "token_count",
              info: {
                last_token_usage: {
                  input_tokens: 500,
                  cached_input_tokens: 100,
                  output_tokens: 250,
                },
              },
            },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:04.000Z",
            payload: { type: "task_complete" },
          },
        ],
      );

      const session = await loadCodexSession("/Users/dev/project", "nested-tokens-uuid");

      const assistant = session.turns[0] as AssistantTurn;
      expect(assistant.usage).toEqual({
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 100,
      });
    });

    test("token_count does not prematurely flush assistant turn", async () => {
      writeNewFormatSession(
        "no-flush-uuid",
        { ...newBaseMeta, payload: { ...newBaseMeta.payload, id: "no-flush-uuid" } },
        [
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:01.000Z",
            payload: { type: "task_started" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:02.000Z",
            payload: { type: "agent_message", message: "Working on it..." },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:03.000Z",
            payload: { type: "token_count", input_tokens: 50, output_tokens: 20 },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:04.000Z",
            payload: { type: "agent_message", message: "All done!" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:05.000Z",
            payload: { type: "task_complete" },
          },
        ],
      );

      const session = await loadCodexSession("/Users/dev/project", "no-flush-uuid");

      // Both messages should be in the same assistant turn (not split by token_count)
      const assistantTurns = session.turns.filter((t) => t.kind === "assistant");
      expect(assistantTurns).toHaveLength(1);
      const assistant = assistantTurns[0] as AssistantTurn;
      expect(assistant.contentBlocks).toHaveLength(2);
      expect(assistant.contentBlocks[0]!.type).toBe("text");
      expect(assistant.contentBlocks[1]!.type).toBe("text");
    });

    test("uses turn_context model when model field absent in new format", async () => {
      const metaNoModel = {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "provider-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      };

      writeNewFormatSession("provider-uuid", metaNoModel, [
        {
          type: "turn_context",
          timestamp: "2026-02-18T10:00:00.500Z",
          payload: {
            model: "gpt-5.3-codex",
          },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:01.000Z",
          payload: { type: "task_started" },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:02.000Z",
          payload: { type: "agent_message", message: "Hello!" },
        },
      ]);

      const session = await loadCodexSession("/Users/dev/project", "provider-uuid");

      const assistant = session.turns[0] as AssistantTurn;
      expect(assistant.model).toBe("gpt-5.3-codex");
    });

    test("falls back to provider as model when no explicit model is present", async () => {
      const metaNoModel = {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "provider-only-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      };

      writeNewFormatSession("provider-only-uuid", metaNoModel, [
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:01.000Z",
          payload: { type: "task_started" },
        },
        {
          type: "event_msg",
          timestamp: "2026-02-18T10:00:02.000Z",
          payload: { type: "agent_message", message: "Hello!" },
        },
      ]);

      const session = await loadCodexSession("/Users/dev/project", "provider-only-uuid");

      const assistant = session.turns[0] as AssistantTurn;
      expect(assistant.model).toBe("openai");
    });
  });
});
