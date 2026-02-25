import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantTurn, UserTurn } from "@cookielab.io/klovi-plugin-core";
import { setOpenCodeDir } from "./config.ts";
import { buildOpenCodeTurns, loadOpenCodeSession, type OpenCodeMessage } from "./parser.ts";

const testDir = join(tmpdir(), `klovi-opencode-parser-test-${Date.now()}`);

function createTestDb(): Database {
  const dbPath = join(testDir, "opencode.db");
  const db = new Database(dbPath, { create: true });

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT NOT NULL,
      name TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      sandboxes TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.run(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      title TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT 'v2',
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  return db;
}

function insertProject(db: Database, id: string, worktree: string): void {
  const now = Date.now();
  db.run(
    "INSERT INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES (?, ?, ?, ?, '[]')",
    [id, worktree, now, now],
  );
}

function insertSession(db: Database, id: string, projectId: string, directory: string): void {
  const now = Date.now();
  db.run(
    "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, '', 'v2', ?, ?)",
    [id, projectId, id, directory, now, now],
  );
}

function insertMessage(
  db: Database,
  id: string,
  sessionId: string,
  data: Record<string, unknown>,
  timeCreated?: number,
): void {
  const now = timeCreated || Date.now();
  db.run(
    "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
    [id, sessionId, now, now, JSON.stringify(data)],
  );
}

function insertPart(
  db: Database,
  id: string,
  messageId: string,
  sessionId: string,
  data: Record<string, unknown>,
): void {
  const now = Date.now();
  db.run(
    "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
    [id, messageId, sessionId, now, now, JSON.stringify(data)],
  );
}

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  setOpenCodeDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("buildOpenCodeTurns", () => {
  test("builds user turn from user message with text parts", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: { role: "user", time: { created: 1706000000 } },
        timeCreated: 1706000000,
        parts: [{ type: "text", text: "Hello, help me fix a bug" }],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(1);
    const user = turns[0] as UserTurn;
    expect(user.kind).toBe("user");
    expect(user.text).toBe("Hello, help me fix a bug");
    expect(user.uuid).toBe("msg-1");
  });

  test("builds assistant turn with text content block", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          providerID: "anthropic",
          tokens: { input: 100, output: 50, cache: { read: 10, write: 5 } },
        },
        timeCreated: 1706000000,
        parts: [{ type: "text", text: "I can help you with that!" }],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.kind).toBe("assistant");
    expect(assistant.model).toBe("claude-sonnet-4-20250514");
    expect(assistant.contentBlocks).toHaveLength(1);
    expect(assistant.contentBlocks[0]?.type).toBe("text");
    if (assistant.contentBlocks[0]?.type === "text") {
      expect(assistant.contentBlocks[0]?.text).toBe("I can help you with that!");
    }
    expect(assistant.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheCreationTokens: 5,
    });
  });

  test("builds thinking block from reasoning part", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          { type: "reasoning", text: "Let me think about this..." },
          { type: "text", text: "Here is my answer." },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(2);
    expect(assistant.contentBlocks[0]?.type).toBe("thinking");
    if (assistant.contentBlocks[0]?.type === "thinking") {
      expect(assistant.contentBlocks[0]?.block.text).toBe("Let me think about this...");
    }
    expect(assistant.contentBlocks[1]?.type).toBe("text");
  });

  test("builds tool call from completed tool part", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          {
            type: "tool",
            callID: "call-123",
            tool: "read_file",
            state: {
              status: "completed",
              input: { path: "/src/main.ts" },
              output: "file contents here",
              title: "Read file",
              metadata: {},
              time: { start: 1706000001, end: 1706000002 },
            },
          },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(1);
    const block = assistant.contentBlocks[0];
    expect(block?.type).toBe("tool_call");
    if (block?.type === "tool_call") {
      expect(block.call.toolUseId).toBe("call-123");
      expect(block.call.name).toBe("read_file");
      expect(block.call.input).toEqual({ path: "/src/main.ts" });
      expect(block.call.result).toBe("file contents here");
      expect(block.call.isError).toBe(false);
    }
  });

  test("builds error tool call from errored tool part", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "gpt-4o",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          {
            type: "tool",
            callID: "call-456",
            tool: "write_file",
            state: {
              status: "error",
              input: { path: "/root/secret" },
              error: "Permission denied",
              time: { start: 1706000001, end: 1706000002 },
            },
          },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0];
    if (block?.type === "tool_call") {
      expect(block.call.isError).toBe(true);
      expect(block.call.result).toBe("Permission denied");
    }
  });

  test("handles pending tool parts as interrupted", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "gpt-4o",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          {
            type: "tool",
            callID: "call-789",
            tool: "bash",
            state: {
              status: "pending",
              input: { command: "ls" },
            },
          },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    const assistant = turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0];
    if (block?.type === "tool_call") {
      expect(block.call.isError).toBe(true);
      expect(block.call.result).toBe("[Tool execution was interrupted]");
    }
  });

  test("ignores text parts marked as ignored", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          { type: "text", text: "system instructions", ignored: true },
          { type: "text", text: "Visible response" },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(1);
    if (assistant.contentBlocks[0]?.type === "text") {
      expect(assistant.contentBlocks[0]?.text).toBe("Visible response");
    }
  });

  test("handles mixed content in a single assistant message", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 300, output: 150, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000000,
        parts: [
          { type: "reasoning", text: "Thinking about the problem..." },
          { type: "text", text: "Let me check the file." },
          {
            type: "tool",
            callID: "call-1",
            tool: "read_file",
            state: {
              status: "completed",
              input: { path: "src/index.ts" },
              output: "content",
              title: "Read file",
              metadata: {},
              time: { start: 1, end: 2 },
            },
          },
          { type: "text", text: "Here are the results." },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(1);
    const assistant = turns[0] as AssistantTurn;
    expect(assistant.contentBlocks).toHaveLength(4);
    expect(assistant.contentBlocks[0]?.type).toBe("thinking");
    expect(assistant.contentBlocks[1]?.type).toBe("text");
    expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
    expect(assistant.contentBlocks[3]?.type).toBe("text");
  });

  test("handles multiple user-assistant turn pairs", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: { role: "user", time: { created: 1706000000 } },
        timeCreated: 1706000000,
        parts: [{ type: "text", text: "Fix the bug" }],
      },
      {
        id: "msg-2",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000001,
        parts: [{ type: "text", text: "I found the issue." }],
      },
      {
        id: "msg-3",
        data: { role: "user", time: { created: 1706000002 } },
        timeCreated: 1706000002,
        parts: [{ type: "text", text: "Great, apply the fix" }],
      },
      {
        id: "msg-4",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 200, output: 100, cache: { read: 0, write: 0 } },
        },
        timeCreated: 1706000003,
        parts: [{ type: "text", text: "Done!" }],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    expect(turns).toHaveLength(4);
    expect(turns[0]?.kind).toBe("user");
    expect(turns[1]?.kind).toBe("assistant");
    expect(turns[2]?.kind).toBe("user");
    expect(turns[3]?.kind).toBe("assistant");
  });

  test("returns empty turns for empty messages", () => {
    const turns = buildOpenCodeTurns([]);
    expect(turns).toEqual([]);
  });

  test("uses step-finish tokens as fallback for usage", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          // No tokens field at message level
        },
        timeCreated: 1706000000,
        parts: [
          { type: "text", text: "Response" },
          {
            type: "step-finish",
            reason: "stop",
            cost: 0.01,
            tokens: {
              input: 500,
              output: 200,
              reasoning: 0,
              cache: { read: 100, write: 50 },
            },
          },
        ],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    const assistant = turns[0] as AssistantTurn;
    expect(assistant.usage).toEqual({
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 100,
      cacheCreationTokens: 50,
    });
  });

  test("captures finish reason from assistant data", () => {
    const messages: OpenCodeMessage[] = [
      {
        id: "msg-1",
        data: {
          role: "assistant",
          modelID: "claude-sonnet-4-20250514",
          tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
          finish: "end_turn",
        },
        timeCreated: 1706000000,
        parts: [{ type: "text", text: "Done" }],
      },
    ];

    const turns = buildOpenCodeTurns(messages);

    const assistant = turns[0] as AssistantTurn;
    expect(assistant.stopReason).toBe("end_turn");
  });
});

describe("loadOpenCodeSession", () => {
  test("loads and parses a full session from DB", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project");
    insertSession(db, "sess-1", "proj-1", "/Users/dev/project");

    // User message
    insertMessage(
      db,
      "msg-1",
      "sess-1",
      {
        role: "user",
        time: { created: 1706000000 },
      },
      1706000000,
    );
    insertPart(db, "part-1", "msg-1", "sess-1", {
      type: "text",
      text: "Fix the authentication bug",
    });

    // Assistant message
    insertMessage(
      db,
      "msg-2",
      "sess-1",
      {
        role: "assistant",
        modelID: "claude-sonnet-4-20250514",
        providerID: "anthropic",
        tokens: { input: 300, output: 150, cache: { read: 50, write: 10 } },
        finish: "end_turn",
      },
      1706000001,
    );
    insertPart(db, "part-2", "msg-2", "sess-1", {
      type: "reasoning",
      text: "Let me analyze the code...",
    });
    insertPart(db, "part-3", "msg-2", "sess-1", {
      type: "text",
      text: "I found the issue in the auth handler.",
    });
    insertPart(db, "part-4", "msg-2", "sess-1", {
      type: "tool",
      callID: "call-1",
      tool: "edit_file",
      state: {
        status: "completed",
        input: { path: "src/auth.ts", content: "fixed code" },
        output: "File updated",
        title: "Edit file",
        metadata: {},
        time: { start: 1706000002, end: 1706000003 },
      },
    });

    db.close();

    const session = await loadOpenCodeSession("proj-1", "sess-1");

    expect(session.sessionId).toBe("sess-1");
    expect(session.pluginId).toBe("opencode");
    expect(session.project).toBe("/Users/dev/project");
    expect(session.turns).toHaveLength(2);

    const user = session.turns[0] as UserTurn;
    expect(user.kind).toBe("user");
    expect(user.text).toBe("Fix the authentication bug");

    const assistant = session.turns[1] as AssistantTurn;
    expect(assistant.kind).toBe("assistant");
    expect(assistant.model).toBe("claude-sonnet-4-20250514");
    expect(assistant.contentBlocks).toHaveLength(3);
    expect(assistant.contentBlocks[0]?.type).toBe("thinking");
    expect(assistant.contentBlocks[1]?.type).toBe("text");
    expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
    expect(assistant.usage).toEqual({
      inputTokens: 300,
      outputTokens: 150,
      cacheReadTokens: 50,
      cacheCreationTokens: 10,
    });
  });

  test("returns empty session when DB does not exist", async () => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });

    const session = await loadOpenCodeSession("proj-1", "nonexistent-sess");

    expect(session.sessionId).toBe("nonexistent-sess");
    expect(session.pluginId).toBe("opencode");
    expect(session.turns).toEqual([]);
  });

  test("returns empty session when session has no messages", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project");
    insertSession(db, "sess-1", "proj-1", "/Users/dev/project");
    db.close();

    const session = await loadOpenCodeSession("proj-1", "sess-1");

    expect(session.turns).toEqual([]);
  });

  test("handles tool error parts correctly", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project");
    insertSession(db, "sess-1", "proj-1", "/Users/dev/project");

    insertMessage(
      db,
      "msg-1",
      "sess-1",
      {
        role: "assistant",
        modelID: "gpt-4o",
        tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
      },
      1706000000,
    );
    insertPart(db, "part-1", "msg-1", "sess-1", {
      type: "tool",
      callID: "call-err",
      tool: "bash",
      state: {
        status: "error",
        input: { command: "rm -rf /" },
        error: "Operation not permitted",
        time: { start: 1706000001, end: 1706000002 },
      },
    });

    db.close();

    const session = await loadOpenCodeSession("proj-1", "sess-1");

    expect(session.turns).toHaveLength(1);
    const assistant = session.turns[0] as AssistantTurn;
    const block = assistant.contentBlocks[0];
    expect(block?.type).toBe("tool_call");
    if (block?.type === "tool_call") {
      expect(block.call.isError).toBe(true);
      expect(block.call.result).toBe("Operation not permitted");
    }
  });

  test("skips malformed message data gracefully", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project");
    insertSession(db, "sess-1", "proj-1", "/Users/dev/project");

    // Insert a malformed message
    const now = Date.now();
    db.run(
      "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
      ["msg-bad", "sess-1", now, now, "not valid json"],
    );

    // Insert a valid message after the bad one
    insertMessage(
      db,
      "msg-good",
      "sess-1",
      {
        role: "assistant",
        modelID: "gpt-4o",
        tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
      },
      now + 1,
    );
    insertPart(db, "part-1", "msg-good", "sess-1", {
      type: "text",
      text: "This should still work",
    });

    db.close();

    const session = await loadOpenCodeSession("proj-1", "sess-1");

    // Should skip the malformed message and still parse the good one
    expect(session.turns).toHaveLength(1);
    const assistant = session.turns[0] as AssistantTurn;
    if (assistant.contentBlocks[0]?.type === "text") {
      expect(assistant.contentBlocks[0]?.text).toBe("This should still work");
    }
  });
});
