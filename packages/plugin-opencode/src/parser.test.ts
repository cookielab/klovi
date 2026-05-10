import { Database } from "bun:sqlite";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantTurn, UserTurn } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { buildOpenCodeTurns, loadOpenCodeSession, type OpenCodeMessage } from "./parser";
import { BunSqliteLayer } from "./runtime/bun-sqlite";


const N_1706000000 = 1_706_000_000;
const N_100 = 100;
const N_50 = 50;
const N_10 = 10;
const N_5 = 5;
const N_1706000001 = 1_706_000_001;
const N_1706000002 = 1_706_000_002;
const N_300 = 300;
const N_150 = 150;
const N_4 = 4;
const N_3 = 3;
const N_200 = 200;
const N_1706000003 = 1_706_000_003;
const N_0_01 = 0.01;
const N_500 = 500;

const testDir = join(tmpdir(), `klovi-opencode-parser-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	BunSqliteLayer,
);

function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

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
	db.run("INSERT INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES (?, ?, ?, ?, '[]')", [
		id,
		worktree,
		now,
		now,
	]);
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
	const now = timeCreated ?? Date.now();
	db.run("INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)", [
		id,
		sessionId,
		now,
		now,
		JSON.stringify(data),
	]);
}

function insertPart(
	db: Database,
	id: string,
	messageId: string,
	sessionId: string,
	data: Record<string, unknown>,
): void {
	const now = Date.now();
	db.run("INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)", [
		id,
		messageId,
		sessionId,
		now,
		now,
		JSON.stringify(data),
	]);
}

beforeEach(async () => {
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("buildOpenCodeTurns", () => {
	it("builds user turn from user message with text parts", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: { role: "user", time: { created: N_1706000000 } },
				timeCreated: N_1706000000,
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

	it("builds assistant turn with text content block", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					["providerID"]: "anthropic",
					tokens: { input: N_100, output: N_50, cache: { read: N_10, write: N_5 } },
				},
				timeCreated: N_1706000000,
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
		const textBlock = assistant.contentBlocks[0] as Extract<(typeof assistant.contentBlocks)[number], { type: "text" }>;
		expect(textBlock.text).toBe("I can help you with that!");
		expect(assistant.usage).toEqual({
			inputTokens: N_100,
			outputTokens: N_50,
			cacheReadTokens: N_10,
			cacheCreationTokens: N_5,
		});
	});

	it("builds thinking block from reasoning part", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
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
		const thinkBlock = assistant.contentBlocks[0] as Extract<
			(typeof assistant.contentBlocks)[number],
			{ type: "thinking" }
		>;
		expect(thinkBlock.block.text).toBe("Let me think about this...");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
	});

	it("builds tool call from completed tool part", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
				parts: [
					{
						type: "tool",
						["callID"]: "call-123",
						tool: "read_file",
						state: {
							status: "completed",
							input: { path: "/src/main.ts" },
							output: "file contents here",
							title: "Read file",
							metadata: {},
							time: { start: N_1706000001, end: N_1706000002 },
						},
					},
				],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		expect(turns).toHaveLength(1);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.contentBlocks).toHaveLength(1);
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.toolUseId).toBe("call-123");
		expect(toolBlock.call.rawName).toBe("read_file");
		expect(toolBlock.call.kind).toBe("file_read");
		expect(toolBlock.call.title).toBe("read_file");
		expect(toolBlock.call.input).toEqual({ path: "/src/main.ts" });
		expect(toolBlock.call.result).toBe("file contents here");
		expect(toolBlock.call.isError).toBe(false);
		expect(toolBlock.call.summary).toBe("/src/main.ts");
		expect(toolBlock.call.formattedInput).toBe("File: /src/main.ts");
	});

	it("builds error tool call from errored tool part", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "gpt-4o",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
				parts: [
					{
						type: "tool",
						["callID"]: "call-456",
						tool: "write_file",
						state: {
							status: "error",
							input: { path: "/root/secret" },
							error: "Permission denied",
							time: { start: N_1706000001, end: N_1706000002 },
						},
					},
				],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		const assistant = turns[0] as AssistantTurn;
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.isError).toBe(true);
		expect(toolBlock.call.result).toBe("Permission denied");
	});

	it("handles pending tool parts as interrupted", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "gpt-4o",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
				parts: [
					{
						type: "tool",
						["callID"]: "call-789",
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
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.isError).toBe(true);
		expect(toolBlock.call.result).toBe("[Tool execution was interrupted]");
	});

	it("ignores text parts marked as ignored", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
				parts: [
					{ type: "text", text: "system instructions", ignored: true },
					{ type: "text", text: "Visible response" },
				],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		const assistant = turns[0] as AssistantTurn;
		expect(assistant.contentBlocks).toHaveLength(1);
		expect(assistant.contentBlocks[0]?.type).toBe("text");
		const visibleBlock = assistant.contentBlocks[0] as Extract<
			(typeof assistant.contentBlocks)[number],
			{ type: "text" }
		>;
		expect(visibleBlock.text).toBe("Visible response");
	});

	it("handles mixed content in a single assistant message", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_300, output: N_150, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000000,
				parts: [
					{ type: "reasoning", text: "Thinking about the problem..." },
					{ type: "text", text: "Let me check the file." },
					{
						type: "tool",
						["callID"]: "call-1",
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
		expect(assistant.contentBlocks).toHaveLength(N_4);
		expect(assistant.contentBlocks[0]?.type).toBe("thinking");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
		expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
		expect(assistant.contentBlocks[N_3]?.type).toBe("text");
	});

	it("handles multiple user-assistant turn pairs", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: { role: "user", time: { created: N_1706000000 } },
				timeCreated: N_1706000000,
				parts: [{ type: "text", text: "Fix the bug" }],
			},
			{
				id: "msg-2",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000001,
				parts: [{ type: "text", text: "I found the issue." }],
			},
			{
				id: "msg-3",
				data: { role: "user", time: { created: N_1706000002 } },
				timeCreated: N_1706000002,
				parts: [{ type: "text", text: "Great, apply the fix" }],
			},
			{
				id: "msg-4",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_200, output: N_100, cache: { read: 0, write: 0 } },
				},
				timeCreated: N_1706000003,
				parts: [{ type: "text", text: "Done!" }],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		expect(turns).toHaveLength(N_4);
		expect(turns[0]?.kind).toBe("user");
		expect(turns[1]?.kind).toBe("assistant");
		expect(turns[2]?.kind).toBe("user");
		expect(turns[N_3]?.kind).toBe("assistant");
	});

	it("returns empty turns for empty messages", () => {
		const turns = buildOpenCodeTurns([]);
		expect(turns).toEqual([]);
	});

	it("uses step-finish tokens as fallback for usage", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					// No tokens field at message level
				},
				timeCreated: N_1706000000,
				parts: [
					{ type: "text", text: "Response" },
					{
						type: "step-finish",
						reason: "stop",
						cost: N_0_01,
						tokens: {
							input: N_500,
							output: N_200,
							reasoning: 0,
							cache: { read: N_100, write: N_50 },
						},
					},
				],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		const assistant = turns[0] as AssistantTurn;
		expect(assistant.usage).toEqual({
			inputTokens: N_500,
			outputTokens: N_200,
			cacheReadTokens: N_100,
			cacheCreationTokens: N_50,
		});
	});

	it("captures finish reason from assistant data", () => {
		const messages: OpenCodeMessage[] = [
			{
				id: "msg-1",
				data: {
					role: "assistant",
					["modelID"]: "claude-sonnet-4-20250514",
					tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
					finish: "end_turn",
				},
				timeCreated: N_1706000000,
				parts: [{ type: "text", text: "Done" }],
			},
		];

		const turns = buildOpenCodeTurns(messages);

		const assistant = turns[0] as AssistantTurn;
		expect(assistant.stopReason).toBe("end_turn");
	});
});

describe("loadOpenCodeSession", () => {
	it("loads and parses a full session from DB", async () => {
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
				time: { created: N_1706000000 },
			},
			N_1706000000,
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
				["modelID"]: "claude-sonnet-4-20250514",
				["providerID"]: "anthropic",
				tokens: { input: N_300, output: N_150, cache: { read: N_50, write: N_10 } },
				finish: "end_turn",
			},
			N_1706000001,
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
			["callID"]: "call-1",
			tool: "edit_file",
			state: {
				status: "completed",
				input: { path: "src/auth.ts", content: "fixed code" },
				output: "File updated",
				title: "Edit file",
				metadata: {},
				time: { start: N_1706000002, end: N_1706000003 },
			},
		});

		db.close();

		const session = await runEffect(loadOpenCodeSession("proj-1", "sess-1"));

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
		expect(assistant.contentBlocks).toHaveLength(N_3);
		expect(assistant.contentBlocks[0]?.type).toBe("thinking");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
		expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
		expect(assistant.usage).toEqual({
			inputTokens: N_300,
			outputTokens: N_150,
			cacheReadTokens: N_50,
			cacheCreationTokens: N_10,
		});
	});

	it("returns empty session when DB does not exist", async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });

		const session = await runEffect(loadOpenCodeSession("proj-1", "nonexistent-sess"));

		expect(session.sessionId).toBe("nonexistent-sess");
		expect(session.pluginId).toBe("opencode");
		expect(session.turns).toEqual([]);
	});

	it("returns empty session when session has no messages", async () => {
		const db = createTestDb();
		insertProject(db, "proj-1", "/Users/dev/project");
		insertSession(db, "sess-1", "proj-1", "/Users/dev/project");
		db.close();

		const session = await runEffect(loadOpenCodeSession("proj-1", "sess-1"));

		expect(session.turns).toEqual([]);
	});

	it("handles tool error parts correctly", async () => {
		const db = createTestDb();
		insertProject(db, "proj-1", "/Users/dev/project");
		insertSession(db, "sess-1", "proj-1", "/Users/dev/project");

		insertMessage(
			db,
			"msg-1",
			"sess-1",
			{
				role: "assistant",
				["modelID"]: "gpt-4o",
				tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
			},
			N_1706000000,
		);
		insertPart(db, "part-1", "msg-1", "sess-1", {
			type: "tool",
			["callID"]: "call-err",
			tool: "bash",
			state: {
				status: "error",
				input: { command: "rm -rf /" },
				error: "Operation not permitted",
				time: { start: N_1706000001, end: N_1706000002 },
			},
		});

		db.close();

		const session = await runEffect(loadOpenCodeSession("proj-1", "sess-1"));

		expect(session.turns).toHaveLength(1);
		const assistant = session.turns[0] as AssistantTurn;
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.isError).toBe(true);
		expect(toolBlock.call.result).toBe("Operation not permitted");
	});

	it("skips malformed message data gracefully", async () => {
		const db = createTestDb();
		insertProject(db, "proj-1", "/Users/dev/project");
		insertSession(db, "sess-1", "proj-1", "/Users/dev/project");

		// Insert a malformed message
		const now = Date.now();
		db.run("INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)", [
			"msg-bad",
			"sess-1",
			now,
			now,
			"not valid json",
		]);

		// Insert a valid message after the bad one
		insertMessage(
			db,
			"msg-good",
			"sess-1",
			{
				role: "assistant",
				["modelID"]: "gpt-4o",
				tokens: { input: N_100, output: N_50, cache: { read: 0, write: 0 } },
			},
			now + 1,
		);
		insertPart(db, "part-1", "msg-good", "sess-1", {
			type: "text",
			text: "This should still work",
		});

		db.close();

		const session = await runEffect(loadOpenCodeSession("proj-1", "sess-1"));

		// Should skip the malformed message and still parse the good one
		expect(session.turns).toHaveLength(1);
		const assistant = session.turns[0] as AssistantTurn;
		expect(assistant.contentBlocks[0]?.type).toBe("text");
		const textBlock = assistant.contentBlocks[0] as Extract<(typeof assistant.contentBlocks)[number], { type: "text" }>;
		expect(textBlock.text).toBe("This should still work");
	});
});
