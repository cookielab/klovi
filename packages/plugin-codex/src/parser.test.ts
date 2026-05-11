import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantTurn } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { buildCodexTurns, type CodexEvent, loadCodexSession } from "./parser";

const N_1706000000 = 1_706_000_000;
const N_1706001000 = 1_706_001_000;
const N_100 = 100;
const N_50 = 50;
const N_3 = 3;
const N_20 = 20;
const N_80 = 80;
const N_30 = 30;
const N_200 = 200;
const N_4 = 4;
const N_300 = 300;
const N_150 = 150;
const N_25 = 25;
const N_500 = 500;
const N_250 = 250;

const testDir = join(tmpdir(), `klovi-codex-parser-test-${Date.now()}`);

const testLayer = Layer.mergeAll(NodeFileSystem.layer, Layer.succeed(PluginConfig, { dataDir: testDir }));

async function writeSession(
	uuid: string,
	meta: Record<string, unknown>,
	events: Record<string, unknown>[] = [],
): Promise<string> {
	const dir = join(testDir, "sessions", "openai", "2025-01-15");
	await mkdir(dir, { recursive: true });
	const filePath = join(dir, `${uuid}.jsonl`);
	const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
	await Bun.write(filePath, lines.join("\n"));
	return filePath;
}

async function writeNewFormatSession(
	uuid: string,
	meta: Record<string, unknown>,
	events: Record<string, unknown>[] = [],
): Promise<string> {
	const dir = join(testDir, "sessions", "2026", "02", "18");
	await mkdir(dir, { recursive: true });
	const filePath = join(dir, `rollout-2026-02-18-${uuid}.jsonl`);
	const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
	await Bun.write(filePath, lines.join("\n"));
	return filePath;
}

const baseMeta = {
	uuid: "test-uuid",
	name: "Test session",
	cwd: "/Users/dev/project",
	timestamps: { created: N_1706000000, updated: N_1706001000 },
	model: "o4-mini",
	["provider_id"]: "openai",
};

const newBaseMeta = {
	type: "session_meta",
	timestamp: "2026-02-18T10:00:00.000Z",
	payload: {
		id: "new-test-uuid",
		cwd: "/Users/dev/project",
		timestamp: "2026-02-18T10:00:00.000Z",
		["model_provider"]: "openai",
		model: "o4-mini",
		originator: "Codex Desktop",
	},
};

beforeEach(async () => {
	await mkdir(join(testDir, "sessions"), { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("buildCodexTurns", () => {
	it("builds assistant turn with text from agent_message", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "Hello, I can help!" } },
			{ type: "turn.completed", usage: { ["input_tokens"]: N_100, ["output_tokens"]: N_50 } },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		expect(turns).toHaveLength(1);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.kind).toBe("assistant");
		expect(assistant.model).toBe("o4-mini");
		expect(assistant.contentBlocks).toHaveLength(1);
		expect(assistant.contentBlocks[0]?.type).toBe("text");
		const textBlock0 = assistant.contentBlocks[0] as Extract<
			(typeof assistant.contentBlocks)[number],
			{ type: "text" }
		>;
		expect(textBlock0.text).toBe("Hello, I can help!");
		expect(assistant.usage).toEqual({
			inputTokens: N_100,
			outputTokens: N_50,
			cacheReadTokens: undefined,
		});
	});

	it("builds thinking content from reasoning items", () => {
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
		expect(assistant.contentBlocks[0]?.type).toBe("thinking");
		const thinkBlock = assistant.contentBlocks[0] as Extract<
			(typeof assistant.contentBlocks)[number],
			{ type: "thinking" }
		>;
		expect(thinkBlock.block.text).toBe("Let me think about this...");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
	});

	it("builds tool call from command_execution", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{
				type: "item.completed",
				item: {
					type: "command_execution",
					command: "ls -la",
					["aggregated_output"]: "total 42\ndrwxr-xr-x 5 user user 160 Jan 15 00:00 .",
					["exit_code"]: 0,
				},
			},
			{ type: "turn.completed" },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		expect(turns).toHaveLength(1);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.contentBlocks).toHaveLength(1);
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("command_execution");
		expect(toolBlock.call.kind).toBe("shell");
		expect(toolBlock.call.title).toBe("Command");
		expect(toolBlock.call.summary).toBe("ls -la");
		expect(toolBlock.call.formattedInput).toBe("ls -la");
		expect(toolBlock.call.input).toEqual({ command: "ls -la" });
		expect(toolBlock.call.result).toContain("total 42");
		expect(toolBlock.call.isError).toBe(false);
	});

	it("marks failed command_execution as error", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{
				type: "item.completed",
				item: {
					type: "command_execution",
					command: "false",
					["aggregated_output"]: "",
					["exit_code"]: 1,
				},
			},
			{ type: "turn.completed" },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		const assistant = turns[0] as AssistantTurn;
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.isError).toBe(true);
	});

	it("builds tool call from file_change", () => {
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
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("file_change");
		expect(toolBlock.call.kind).toBe("file_edit");
		expect(toolBlock.call.title).toBe("File Change");
		expect(toolBlock.call.summary).toBe("src/main.ts");
		expect(toolBlock.call.formattedInput).toBe("edit: src/main.ts\ncreate: src/utils.ts");
		expect(toolBlock.call.input).toEqual({
			changes: [
				{ path: "src/main.ts", kind: "edit" },
				{ path: "src/utils.ts", kind: "create" },
			],
		});
		expect(toolBlock.call.isError).toBe(false);
	});

	it("builds tool call from mcp_tool_call", () => {
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
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("search_docs");
		expect(toolBlock.call.kind).toBe("mcp");
		expect(toolBlock.call.title).toBe("search_docs");
		expect(toolBlock.call.input).toEqual({ query: "authentication" });
		expect(toolBlock.call.result).toBe("Found 3 results");
	});

	it("builds tool call from web_search", () => {
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
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("web_search");
		expect(toolBlock.call.kind).toBe("web");
		expect(toolBlock.call.title).toBe("Web Search");
		expect(toolBlock.call.summary).toBe("how to use bun test");
		expect(toolBlock.call.formattedInput).toBe("Query: how to use bun test");
		expect(toolBlock.call.input).toEqual({ query: "how to use bun test" });
	});

	it("uses deterministic generated UUIDs per parsed session", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "First response" } },
			{ type: "turn.completed" },
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "Second response" } },
			{ type: "turn.completed" },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		expect(turns).toHaveLength(N_3);
		expect(turns[0]).toMatchObject({ kind: "assistant", uuid: "codex-assistant-1" });
		expect(turns[1]).toMatchObject({ kind: "user", uuid: "codex-user-1" });
		expect(turns[2]).toMatchObject({ kind: "assistant", uuid: "codex-assistant-2" });
	});

	it("handles multiple turns", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "First response" } },
			{ type: "turn.completed", usage: { ["input_tokens"]: N_50, ["output_tokens"]: N_20 } },
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "Second response" } },
			{ type: "turn.completed", usage: { ["input_tokens"]: N_80, ["output_tokens"]: N_30 } },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		// First turn is assistant, then user (empty, from second turn.started), then assistant
		expect(turns).toHaveLength(N_3);
		expect(turns[0]?.kind).toBe("assistant");
		expect(turns[1]?.kind).toBe("user");
		expect(turns[2]?.kind).toBe("assistant");

		const first = turns[0] as AssistantTurn;
		expect(first.contentBlocks[0]?.type).toBe("text");
		const textBlock = first.contentBlocks[0] as Extract<(typeof first.contentBlocks)[number], { type: "text" }>;
		expect(textBlock.text).toBe("First response");
	});

	it("captures usage from turn.completed with cached tokens", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "Response" } },
			{
				type: "turn.completed",
				usage: { ["input_tokens"]: N_200, ["output_tokens"]: N_100, ["cached_input_tokens"]: N_50 },
			},
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		const assistant = turns[0] as AssistantTurn;
		expect(assistant.usage).toEqual({
			inputTokens: N_200,
			outputTokens: N_100,
			cacheReadTokens: N_50,
		});
	});

	it("handles mixed content blocks in a single turn", () => {
		const events: CodexEvent[] = [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "reasoning", text: "Thinking..." } },
			{ type: "item.completed", item: { type: "agent_message", text: "Let me check." } },
			{
				type: "item.completed",
				item: {
					type: "command_execution",
					command: "cat file.ts",
					["aggregated_output"]: "content",
					["exit_code"]: 0,
				},
			},
			{ type: "item.completed", item: { type: "agent_message", text: "Here are the results." } },
			{ type: "turn.completed" },
		];

		const turns = buildCodexTurns(events, "o4-mini", "2025-01-15T00:00:00Z");

		expect(turns).toHaveLength(1);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.contentBlocks).toHaveLength(N_4);
		expect(assistant.contentBlocks[0]?.type).toBe("thinking");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
		expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
		expect(assistant.contentBlocks[N_3]?.type).toBe("text");
	});

	it("returns empty turns for empty events", () => {
		const turns = buildCodexTurns([], "o4-mini", "2025-01-15T00:00:00Z");
		expect(turns).toEqual([]);
	});
});

describe("loadCodexSession", () => {
	it("loads and parses a full session file", async () => {
		await writeSession("test-uuid", baseMeta, [
			{ type: "thread.started" },
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "reasoning", text: "Let me analyze..." } },
			{ type: "item.completed", item: { type: "agent_message", text: "I found the issue." } },
			{
				type: "item.completed",
				item: {
					type: "command_execution",
					command: "git diff",
					["aggregated_output"]: "+new line",
					["exit_code"]: 0,
				},
			},
			{ type: "turn.completed", usage: { ["input_tokens"]: N_300, ["output_tokens"]: N_150 } },
		]);

		const session = await Effect.runPromise(
			loadCodexSession("/Users/dev/project", "test-uuid").pipe(Effect.provide(testLayer)),
		);

		expect(session.sessionId).toBe("test-uuid");
		expect(session.pluginId).toBe("codex-cli");
		expect(session.turns).toHaveLength(1);

		const assistant = session.turns[0] as AssistantTurn;
		expect(assistant.kind).toBe("assistant");
		expect(assistant.model).toBe("o4-mini");
		expect(assistant.contentBlocks).toHaveLength(N_3);
		expect(assistant.contentBlocks[0]?.type).toBe("thinking");
		expect(assistant.contentBlocks[1]?.type).toBe("text");
		expect(assistant.contentBlocks[2]?.type).toBe("tool_call");
	});

	it("returns empty session when file not found", async () => {
		const session = await Effect.runPromise(
			loadCodexSession("/Users/dev/project", "nonexistent-uuid").pipe(Effect.provide(testLayer)),
		);

		expect(session.sessionId).toBe("nonexistent-uuid");
		expect(session.pluginId).toBe("codex-cli");
		expect(session.turns).toEqual([]);
	});

	it("loads session with file_change events", async () => {
		await writeSession("fc-uuid", { ...baseMeta, uuid: "fc-uuid" }, [
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

		const session = await Effect.runPromise(
			loadCodexSession("/Users/dev/project", "fc-uuid").pipe(Effect.provide(testLayer)),
		);

		expect(session.turns).toHaveLength(1);
		const assistant = session.turns[0] as AssistantTurn;
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("file_change");
	});

	it("loads session with mcp_tool_call events", async () => {
		await writeSession("mcp-uuid", { ...baseMeta, uuid: "mcp-uuid" }, [
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

		const session = await Effect.runPromise(
			loadCodexSession("/Users/dev/project", "mcp-uuid").pipe(Effect.provide(testLayer)),
		);

		const assistant = session.turns[0] as AssistantTurn;
		const [block] = assistant.contentBlocks;
		expect(block?.type).toBe("tool_call");
		const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
		expect(toolBlock.call.rawName).toBe("search");
		expect(toolBlock.call.input).toEqual({ q: "test" });
		expect(toolBlock.call.result).toBe("Found results");
	});

	it("handles usage tracking across turns", async () => {
		await writeSession("usage-uuid", { ...baseMeta, uuid: "usage-uuid" }, [
			{ type: "turn.started" },
			{ type: "item.completed", item: { type: "agent_message", text: "Response 1" } },
			{
				type: "turn.completed",
				usage: { ["input_tokens"]: N_100, ["output_tokens"]: N_50, ["cached_input_tokens"]: N_25 },
			},
		]);

		const session = await Effect.runPromise(
			loadCodexSession("/Users/dev/project", "usage-uuid").pipe(Effect.provide(testLayer)),
		);

		const assistant = session.turns[0] as AssistantTurn;
		expect(assistant.usage).toEqual({
			inputTokens: N_100,
			outputTokens: N_50,
			cacheReadTokens: N_25,
		});
	});
});

describe("new envelope format", () => {
	describe("loadCodexSession", () => {
		it("loads session with new-format metadata and events", async () => {
			await writeNewFormatSession("new-test-uuid", newBaseMeta, [
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
					payload: { type: "token_count", ["input_tokens"]: N_200, ["output_tokens"]: N_80 },
				},
				{
					type: "event_msg",
					timestamp: "2026-02-18T10:00:05.000Z",
					payload: { type: "task_complete" },
				},
			]);

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "new-test-uuid").pipe(Effect.provide(testLayer)),
			);

			expect(session.sessionId).toBe("new-test-uuid");
			expect(session.pluginId).toBe("codex-cli");
			// First turn: user message, then assistant response
			expect(session.turns).toHaveLength(2);
			expect(session.turns[0]?.kind).toBe("user");
			const userTurn = session.turns[0] as Extract<(typeof session.turns)[number], { kind: "user" }>;
			expect(userTurn.text).toBe("Fix the bug");

			const assistant = session.turns[1] as AssistantTurn;
			expect(assistant.kind).toBe("assistant");
			expect(assistant.model).toBe("o4-mini");
			expect(assistant.contentBlocks).toHaveLength(2);
			expect(assistant.contentBlocks[0]?.type).toBe("thinking");
			const thinkBlock = assistant.contentBlocks[0] as Extract<
				(typeof assistant.contentBlocks)[number],
				{ type: "thinking" }
			>;
			expect(thinkBlock.block.text).toBe("Let me think...");
			expect(assistant.contentBlocks[1]?.type).toBe("text");
			const textBlock = assistant.contentBlocks[1] as Extract<
				(typeof assistant.contentBlocks)[number],
				{ type: "text" }
			>;
			expect(textBlock.text).toBe("I found the issue.");
			expect(assistant.usage).toEqual({
				inputTokens: N_200,
				outputTokens: N_80,
				cacheReadTokens: undefined,
			});
		});

		it("loads new-format session with command execution", async () => {
			await writeNewFormatSession("cmd-uuid", { ...newBaseMeta, payload: { ...newBaseMeta.payload, id: "cmd-uuid" } }, [
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
						["call_id"]: "call_abc",
						arguments: '{"cmd":"ls -la","workdir":"/tmp"}',
					},
				},
				{
					type: "response_item",
					timestamp: "2026-02-18T10:00:02.500Z",
					payload: {
						type: "function_call_output",
						["call_id"]: "call_abc",
						output: "file1.ts\nfile2.ts",
					},
				},
				{
					type: "event_msg",
					timestamp: "2026-02-18T10:00:03.000Z",
					payload: { type: "token_count", ["input_tokens"]: N_100, ["output_tokens"]: N_50 },
				},
				{
					type: "event_msg",
					timestamp: "2026-02-18T10:00:04.000Z",
					payload: { type: "task_complete" },
				},
			]);

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "cmd-uuid").pipe(Effect.provide(testLayer)),
			);

			expect(session.turns).toHaveLength(1);
			const assistant = session.turns[0] as AssistantTurn;
			expect(assistant.contentBlocks).toHaveLength(1);
			const [block] = assistant.contentBlocks;
			expect(block?.type).toBe("tool_call");
			const toolBlock = block as Extract<typeof block, { type: "tool_call" }>;
			expect(toolBlock.call.rawName).toBe("exec_command");
			expect(toolBlock.call.input).toEqual({ cmd: "ls -la", workdir: "/tmp" });
			expect(toolBlock.call.result).toBe("file1.ts\nfile2.ts");
			expect(toolBlock.call.isError).toBe(false);
		});

		it("finds new-format file by session ID with rollout prefix", async () => {
			await writeNewFormatSession(
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

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "rollout-uuid").pipe(Effect.provide(testLayer)),
			);

			expect(session.turns).toHaveLength(1);
			const assistant = session.turns[0] as AssistantTurn;
			expect(assistant.contentBlocks[0]?.type).toBe("text");
		});

		it("returns empty session when new-format file not found", async () => {
			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "nonexistent-new-uuid").pipe(Effect.provide(testLayer)),
			);

			expect(session.sessionId).toBe("nonexistent-new-uuid");
			expect(session.turns).toEqual([]);
		});

		it("extracts tokens from nested info.last_token_usage in new format", async () => {
			await writeNewFormatSession(
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
								["last_token_usage"]: {
									["input_tokens"]: N_500,
									["cached_input_tokens"]: N_100,
									["output_tokens"]: N_250,
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

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "nested-tokens-uuid").pipe(Effect.provide(testLayer)),
			);

			const assistant = session.turns[0] as AssistantTurn;
			expect(assistant.usage).toEqual({
				inputTokens: N_500,
				outputTokens: N_250,
				cacheReadTokens: N_100,
			});
		});

		it("token_count does not prematurely flush assistant turn", async () => {
			await writeNewFormatSession(
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
						payload: { type: "token_count", ["input_tokens"]: N_50, ["output_tokens"]: N_20 },
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

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "no-flush-uuid").pipe(Effect.provide(testLayer)),
			);

			// Both messages should be in the same assistant turn (not split by token_count)
			const assistantTurns = session.turns.filter((t) => t.kind === "assistant");
			expect(assistantTurns).toHaveLength(1);
			const assistant = assistantTurns[0] as AssistantTurn;
			expect(assistant.contentBlocks).toHaveLength(2);
			expect(assistant.contentBlocks[0]?.type).toBe("text");
			expect(assistant.contentBlocks[1]?.type).toBe("text");
		});

		it("uses turn_context model when model field absent in new format", async () => {
			const metaNoModel = {
				type: "session_meta",
				timestamp: "2026-02-18T10:00:00.000Z",
				payload: {
					id: "provider-uuid",
					cwd: "/Users/dev/project",
					timestamp: "2026-02-18T10:00:00.000Z",
					["model_provider"]: "openai",
				},
			};

			await writeNewFormatSession("provider-uuid", metaNoModel, [
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

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "provider-uuid").pipe(Effect.provide(testLayer)),
			);

			const assistant = session.turns[0] as AssistantTurn;
			expect(assistant.model).toBe("gpt-5.3-codex");
		});

		it("falls back to provider as model when no explicit model is present", async () => {
			const metaNoModel = {
				type: "session_meta",
				timestamp: "2026-02-18T10:00:00.000Z",
				payload: {
					id: "provider-only-uuid",
					cwd: "/Users/dev/project",
					timestamp: "2026-02-18T10:00:00.000Z",
					["model_provider"]: "openai",
				},
			};

			await writeNewFormatSession("provider-only-uuid", metaNoModel, [
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

			const session = await Effect.runPromise(
				loadCodexSession("/Users/dev/project", "provider-only-uuid").pipe(Effect.provide(testLayer)),
			);

			const assistant = session.turns[0] as AssistantTurn;
			expect(assistant.model).toBe("openai");
		});
	});
});
