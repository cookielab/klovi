import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryRequirements, Session, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { PluginError, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { ToolPlugin } from "./plugin-types.ts";
import { PluginRegistry } from "./registry.ts";
import { getStats, getStatsCachePath, invalidateStatsCache } from "./stats-service.ts";

const testLayer = Layer.merge(
	NodeFileSystem.layer,
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);
const runEffect = <A>(effect: Effect.Effect<A, never, RegistryRequirements>) =>
	Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

const testConfig = { dataDir: "/test" };
const tempDirs = new Set<string>();

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
				contentBlocks: [{ type: "text", text: "result" }],
			},
		],
	};
}

function createMockPlugin(sessionsById: Record<string, Session>, list: SessionSummary[]): ToolPlugin {
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

async function makeSettingsPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "klovi-stats-cache-"));
	tempDirs.add(dir);
	return join(dir, "settings.json");
}

function waitFor(condition: () => Promise<boolean>, timeoutMs = 1000): Promise<void> {
	const startedAt = Date.now();

	const poll = async (): Promise<void> => {
		if (await condition()) {
			return;
		}

		if (Date.now() - startedAt >= timeoutMs) {
			throw new Error("Timed out waiting for condition");
		}

		await new Promise((resolve) => setTimeout(resolve, 10));
		return poll();
	};

	return poll();
}

afterEach(async () => {
	await Promise.all([...tempDirs].map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs.clear();
});

describe("stats-service", () => {
	test("writes a stats cache file next to settings.json on cold load", async () => {
		const settingsPath = await makeSettingsPath();
		const registry = new PluginRegistry();
		const session = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 10, 5);
		const list: SessionSummary[] = [
			{
				sessionId: "s1",
				timestamp: session.turns[0]?.timestamp ?? "",
				slug: "s1",
				firstMessage: "session 1",
				model: "claude-opus",
				gitBranch: "main",
			},
		];

		registry.register(createMockPlugin({ s1: session }, list), testConfig);

		const result = await runEffect(getStats(settingsPath, registry));
		expect(result.refreshing).toBe(false);
		expect(result.stats.inputTokens).toBe(10);

		const cachedRaw = await readFile(getStatsCachePath(settingsPath), "utf-8");
		const cached = JSON.parse(cachedRaw) as {
			version: number;
			cachedAt: string;
			stats: { inputTokens: number };
		};

		expect(cached.version).toBe(1);
		expect(typeof cached.cachedAt).toBe("string");
		expect(cached.stats.inputTokens).toBe(10);
	});

	test("returns the sidecar cache first and refreshes it in the background", async () => {
		const settingsPath = await makeSettingsPath();
		const registry = new PluginRegistry();
		const session = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 99, 5);
		const list: SessionSummary[] = [
			{
				sessionId: "s1",
				timestamp: session.turns[0]?.timestamp ?? "",
				slug: "s1",
				firstMessage: "session 1",
				model: "claude-opus",
				gitBranch: "main",
			},
		];

		registry.register(createMockPlugin({ s1: session }, list), testConfig);

		await writeFile(
			getStatsCachePath(settingsPath),
			JSON.stringify(
				{
					version: 1,
					cachedAt: "2000-01-01T00:00:00.000Z",
					stats: {
						projects: 1,
						sessions: 1,
						messages: 2,
						todaySessions: 0,
						thisWeekSessions: 0,
						inputTokens: 10,
						outputTokens: 5,
						cacheReadTokens: 3,
						cacheCreationTokens: 2,
						toolCalls: 0,
						models: {},
					},
				},
				null,
				2,
			),
		);

		const cachedFirst = await runEffect(getStats(settingsPath, registry));
		expect(cachedFirst.stats.inputTokens).toBe(10);
		expect(cachedFirst.refreshing).toBe(true);

		await waitFor(async () => {
			const refreshedRaw = await readFile(getStatsCachePath(settingsPath), "utf-8");
			const refreshed = JSON.parse(refreshedRaw) as { stats: { inputTokens: number } };
			return refreshed.stats.inputTokens === 99;
		});

		const refreshed = await runEffect(getStats(settingsPath, registry));
		expect(refreshed.stats.inputTokens).toBe(99);
		expect(refreshed.refreshing).toBe(false);
	});

	test("invalidates the sidecar cache file", async () => {
		const settingsPath = await makeSettingsPath();
		await writeFile(
			getStatsCachePath(settingsPath),
			JSON.stringify({ version: 1, cachedAt: "2000-01-01T00:00:00.000Z", stats: {} }),
		);

		await runEffect(invalidateStatsCache(settingsPath));

		await expect(readFile(getStatsCachePath(settingsPath), "utf-8")).rejects.toThrow();
	});
});
