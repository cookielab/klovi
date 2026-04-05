import { describe, expect, test } from "bun:test";
import type { RegistryRequirements, Session, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { PluginError, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { ToolPlugin } from "./plugin-types.ts";
import { PluginRegistry } from "./registry.ts";
import { scanStats } from "./stats.ts";

const testLayer = Layer.merge(
	NodeFileSystem.layer,
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);
const runEffect = <A>(effect: Effect.Effect<A, never, RegistryRequirements>) =>
	Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

const testConfig = { dataDir: "/test" };

function isoDaysAgo(days: number): string {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() - days);
	return d.toISOString();
}

// biome-ignore lint/complexity/useMaxParams: test helper with positional args for readability
function makeSession(
	id: string,
	project: string,
	timestamp: string,
	model: string,
	inputTokens: number,
	outputTokens: number,
): Session {
	return {
		sessionId: id,
		project: project,
		pluginId: "mock-plugin",
		turns: [
			{
				kind: "user",
				uuid: `${id}-user`,
				timestamp: timestamp,
				text: "hello",
			},
			{
				kind: "assistant",
				uuid: `${id}-assistant`,
				timestamp: timestamp,
				model: model,
				usage: {
					inputTokens: inputTokens,
					outputTokens: outputTokens,
					cacheReadTokens: 3,
					cacheCreationTokens: 2,
				},
				contentBlocks: [
					{ type: "text", text: "result" },
					{
						type: "tool_call",
						call: {
							toolUseId: `${id}-tool-1`,
							name: "Read",
							input: { file_path: "README.md" },
							result: "ok",
							isError: false,
						},
					},
				],
			},
		],
	};
}

function createMockPlugin(
	sessionsById: Record<string, Session>,
	list: SessionSummary[],
	options?: { failLoad?: boolean },
): ToolPlugin {
	return {
		id: "mock-plugin",
		displayName: "Mock",
		getDefaultDataDir: () => null,
		isDataAvailable: Effect.succeed(true),
		discoverProjects: Effect.succeed([
			{
				pluginId: "mock-plugin",
				nativeId: "project-1",
				resolvedPath: "/tmp/project-1",
				displayName: "project-1",
				sessionCount: list.length,
				lastActivity: list[0]?.timestamp ?? "",
			},
		]),
		listSessions: () => Effect.succeed(list),
		loadSession: (_nativeId, sessionId) => {
			if (options?.failLoad) {
				return Effect.fail(
					new PluginError({
						pluginId: "mock-plugin",
						operation: "loadSession",
						message: "load failed",
					}),
				);
			}
			const session = sessionsById[sessionId];
			if (!session) {
				return Effect.fail(
					new PluginError({
						pluginId: "mock-plugin",
						operation: "loadSession",
						message: "missing session",
					}),
				);
			}
			return Effect.succeed(session);
		},
	};
}

describe("scanStats", () => {
	test("aggregates multi-tool style stats from registry sessions", async () => {
		const registry = new PluginRegistry();

		const s1 = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 100, 40);
		const s2 = makeSession("s2", "project-1", isoDaysAgo(8), "gpt-5", 60, 20);

		const list: SessionSummary[] = [
			{
				sessionId: "s1",
				timestamp: s1.turns[0]?.timestamp ?? "",
				slug: "s1",
				firstMessage: "session 1",
				model: "claude-opus",
				gitBranch: "main",
			},
			{
				sessionId: "s2",
				timestamp: s2.turns[0]?.timestamp ?? "",
				slug: "s2",
				firstMessage: "session 2",
				model: "gpt-5",
				gitBranch: "main",
			},
		];

		registry.register(createMockPlugin({ s1: s1, s2: s2 }, list), testConfig);

		const stats = await runEffect(scanStats(registry));
		expect(stats.projects).toBe(1);
		expect(stats.sessions).toBe(2);
		expect(stats.todaySessions).toBe(1);
		expect(stats.thisWeekSessions).toBe(1);
		expect(stats.messages).toBe(4);
		expect(stats.toolCalls).toBe(2);
		expect(stats.inputTokens).toBe(160);
		expect(stats.outputTokens).toBe(60);
		expect(stats.cacheReadTokens).toBe(6);
		expect(stats.cacheCreationTokens).toBe(4);
		expect(stats.models["claude-opus"]?.inputTokens).toBe(100);
		expect(stats.models["gpt-5"]?.outputTokens).toBe(20);
	});

	test("keeps project/session counts when session loading fails", async () => {
		const registry = new PluginRegistry();

		const list: SessionSummary[] = [
			{
				sessionId: "s1",
				timestamp: isoDaysAgo(0),
				slug: "s1",
				firstMessage: "session 1",
				model: "unknown",
				gitBranch: "",
			},
		];

		registry.register(createMockPlugin({}, list, { failLoad: true }), testConfig);

		const stats = await runEffect(scanStats(registry));
		expect(stats.projects).toBe(1);
		expect(stats.sessions).toBe(1);
		expect(stats.messages).toBe(0);
		expect(stats.inputTokens).toBe(0);
	});

	test("recomputes stats on each call", async () => {
		const registry = new PluginRegistry();
		let session = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 10, 5);

		const list: SessionSummary[] = [
			{
				sessionId: "s1",
				timestamp: isoDaysAgo(0),
				slug: "s1",
				firstMessage: "session 1",
				model: "claude-opus",
				gitBranch: "",
			},
		];

		registry.register(
			createMockPlugin(
				{
					s1: session,
				},
				list,
			),
			testConfig,
		);

		const first = await runEffect(scanStats(registry));
		expect(first.inputTokens).toBe(10);

		session = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 999, 5);
		registry.register(
			createMockPlugin(
				{
					s1: session,
				},
				list,
			),
			testConfig,
		);
		const second = await runEffect(scanStats(registry));
		expect(second.inputTokens).toBe(999);
	});
});
