import { describe, expect, test } from "bun:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { PluginError } from "./plugin-errors.ts";
import { encodeResolvedPath, PluginRegistry } from "./plugin-registry.ts";
import type { RegistryRequirements } from "./plugin-runtime.ts";
import type {
	PluginDiscoveryIndex,
	PluginProject,
	RegistrySession,
	RegistrySessionSummary,
	ToolPlugin,
} from "./plugin-types.ts";
import { SqliteClientTag } from "./sqlite-service.ts";

interface TestSessionSummary extends RegistrySessionSummary {
	slug: string;
	firstMessage: string;
}

interface TestSession extends RegistrySession {
	turns: string[];
}

function createPlugin(
	id: string,
	projects: PluginProject<string>[],
	sessionsByNativeId: Record<string, TestSessionSummary[]> = {},
): ToolPlugin<string, TestSessionSummary, TestSession> {
	return {
		id: id,
		displayName: id,
		getDefaultDataDir: () => null,
		isDataAvailable: Effect.succeed(true),
		discoverProjects: Effect.succeed(projects),
		listSessions: (nativeId: string) => Effect.succeed(sessionsByNativeId[nativeId] ?? []),
		loadSession: (_nativeId: string, sessionId: string) => Effect.succeed({ sessionId: sessionId, turns: [] }),
	};
}

function createIndexedPlugin(
	id: string,
	index: PluginDiscoveryIndex<string, TestSessionSummary>,
	options: {
		listSessions?: ToolPlugin<string, TestSessionSummary, TestSession>["listSessions"];
	} = {},
): ToolPlugin<string, TestSessionSummary, TestSession> {
	return {
		id: id,
		displayName: id,
		getDefaultDataDir: () => null,
		isDataAvailable: Effect.succeed(true),
		discoverProjects: Effect.succeed(index.projects),
		discoverIndex: Effect.succeed(index),
		listSessions: options.listSessions ?? ((_nativeId: string) => Effect.succeed([])),
		loadSession: (_nativeId: string, sessionId: string) => Effect.succeed({ sessionId: sessionId, turns: [] }),
	};
}

function createFailingPlugin(id: string): ToolPlugin<string, TestSessionSummary, TestSession> {
	return {
		id: id,
		displayName: id,
		getDefaultDataDir: () => null,
		isDataAvailable: Effect.succeed(false),
		discoverProjects: Effect.fail(
			new PluginError({ pluginId: id, operation: "discover", message: "discovery failed" }),
		),
		listSessions: () =>
			Effect.fail(new PluginError({ pluginId: id, operation: "listSessions", message: "list failed" })),
		loadSession: (_nativeId: string, sessionId: string) => Effect.succeed({ sessionId: sessionId, turns: [] }),
	};
}

const testConfig = { dataDir: "/tmp/test" };

const testLayer = Layer.merge(
	NodeFileSystem.layer,
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);
const runEffect = <A>(effect: Effect.Effect<A, never, RegistryRequirements>) =>
	Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

describe("PluginRegistry", () => {
	test("register and getPlugin", () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
		const plugin = createPlugin("claude-code", []);

		registry.register(plugin, testConfig);

		expect(registry.getPlugin("claude-code")).toBe(plugin);
	});

	test("registering the same plugin id replaces previous plugin", () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
		const first = createPlugin("codex-cli", []);
		const second = createPlugin("codex-cli", []);

		registry.register(first, testConfig);
		registry.register(second, testConfig);

		expect(registry.getAllPlugins()).toHaveLength(1);
		expect(registry.getPlugin("codex-cli")).toBe(second);
	});

	test("getPlugin throws when plugin id is missing", () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		expect(() => registry.getPlugin("missing")).toThrow("Plugin not found: missing");
	});

	test("discoverAllProjects merges projects sharing resolvedPath", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("claude-code", [
				{
					pluginId: "claude-code",
					nativeId: "a",
					resolvedPath: "/Users/dev/project",
					displayName: "Project",
					sessionCount: 2,
					lastActivity: "2026-02-20T08:00:00Z",
				},
				{
					pluginId: "claude-code",
					nativeId: "a-duplicate",
					resolvedPath: "/Users/dev/project",
					displayName: "Project",
					sessionCount: 1,
					lastActivity: "2026-02-21T09:00:00Z",
				},
			]),
			testConfig,
		);
		registry.register(
			createPlugin("codex-cli", [
				{
					pluginId: "codex-cli",
					nativeId: "b",
					resolvedPath: "/Users/dev/project",
					displayName: "Project",
					sessionCount: 3,
					lastActivity: "2026-02-22T10:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(1);
		expect(merged[0]?.resolvedPath).toBe("/Users/dev/project");
		expect(merged[0]?.sessionCount).toBe(6);
		expect(merged[0]?.lastActivity).toBe("2026-02-22T10:00:00Z");
		expect(merged[0]?.sources).toEqual([
			{ pluginId: "claude-code", nativeId: "a" },
			{ pluginId: "claude-code", nativeId: "a-duplicate" },
			{ pluginId: "codex-cli", nativeId: "b" },
		]);
	});

	test("discoverAllProjects keeps projects with different paths separate and sorted", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("opencode", [
				{
					pluginId: "opencode",
					nativeId: "n1",
					resolvedPath: "/Users/dev/older",
					displayName: "older",
					sessionCount: 1,
					lastActivity: "2026-02-20T08:00:00Z",
				},
				{
					pluginId: "opencode",
					nativeId: "n2",
					resolvedPath: "/Users/dev/newer",
					displayName: "newer",
					sessionCount: 1,
					lastActivity: "2026-02-21T08:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(2);
		expect(merged[0]?.resolvedPath).toBe("/Users/dev/newer");
		expect(merged[1]?.resolvedPath).toBe("/Users/dev/older");
	});

	test("discoverAllProjects tolerates per-plugin discovery failures", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(createFailingPlugin("broken"), testConfig);
		registry.register(
			createPlugin("claude-code", [
				{
					pluginId: "claude-code",
					nativeId: "a",
					resolvedPath: "/Users/dev/project",
					displayName: "project",
					sessionCount: 1,
					lastActivity: "2026-02-20T08:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(1);
		expect(merged[0]?.resolvedPath).toBe("/Users/dev/project");
	});

	test("discoverAllProjects with no plugins returns empty list", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toEqual([]);
	});

	test("listAllSessions aggregates and sorts sessions from project sources", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("claude-code", [], {
				a: [
					{
						sessionId: "session-1",
						timestamp: "2026-02-20T08:00:00Z",
						pluginId: "not-expected",
						slug: "session-1",
						firstMessage: "one",
					},
				],
			}),
			testConfig,
		);

		registry.register(
			createPlugin("codex-cli", [], {
				b: [
					{
						sessionId: "session-2",
						timestamp: "2026-02-21T08:00:00Z",
						slug: "session-2",
						firstMessage: "two",
					},
				],
			}),
			testConfig,
		);

		const sessions = await runEffect(
			registry.listAllSessions({
				encodedPath: "-Users-dev-project",
				resolvedPath: "/Users/dev/project",
				name: "/Users/dev/project",
				fullPath: "/Users/dev/project",
				sessionCount: 2,
				lastActivity: "2026-02-21T08:00:00Z",
				sources: [
					{ pluginId: "claude-code", nativeId: "a" },
					{ pluginId: "codex-cli", nativeId: "b" },
				],
			}),
		);

		expect(sessions).toHaveLength(2);
		expect(sessions[0]?.sessionId).toBe("codex-cli::session-2");
		expect(sessions[0]?.pluginId).toBe("codex-cli");
		expect(sessions[1]?.sessionId).toBe("claude-code::session-1");
		expect(sessions[1]?.pluginId).toBe("claude-code");
	});

	test("listAllSessions skips missing plugins and failing sources", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(createFailingPlugin("broken"), testConfig);
		registry.register(
			createPlugin("opencode", [], {
				ok: [
					{
						sessionId: "session-1",
						timestamp: "2026-02-21T08:00:00Z",
						slug: "session-1",
						firstMessage: "one",
					},
				],
			}),
			testConfig,
		);

		const sessions = await runEffect(
			registry.listAllSessions({
				encodedPath: "-Users-dev-project",
				resolvedPath: "/Users/dev/project",
				name: "/Users/dev/project",
				fullPath: "/Users/dev/project",
				sessionCount: 3,
				lastActivity: "2026-02-21T08:00:00Z",
				sources: [
					{ pluginId: "missing", nativeId: "n/a" },
					{ pluginId: "broken", nativeId: "broken-native" },
					{ pluginId: "opencode", nativeId: "ok" },
				],
			}),
		);

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("opencode::session-1");
	});

	test("listAllSessions supports custom sessionId encoder", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>({
			encodeSessionId: (pluginId, rawSessionId) => `${pluginId}/${rawSessionId}`,
		});

		registry.register(
			createPlugin("claude-code", [], {
				a: [
					{
						sessionId: "abc",
						timestamp: "2026-02-21T08:00:00Z",
						slug: "abc",
						firstMessage: "one",
					},
				],
			}),
			testConfig,
		);

		const sessions = await runEffect(
			registry.listAllSessions({
				encodedPath: "-Users-dev-project",
				resolvedPath: "/Users/dev/project",
				name: "/Users/dev/project",
				fullPath: "/Users/dev/project",
				sessionCount: 1,
				lastActivity: "2026-02-21T08:00:00Z",
				sources: [{ pluginId: "claude-code", nativeId: "a" }],
			}),
		);

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("claude-code/abc");
	});

	test("discoverAllProjectsWithSessions reuses plugin discovery indexes", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
		let listSessionsCalls = 0;

		registry.register(
			createIndexedPlugin(
				"cursor",
				{
					projects: [
						{
							pluginId: "cursor",
							nativeId: "/Users/dev/project",
							resolvedPath: "/Users/dev/project",
							displayName: "project",
							sessionCount: 2,
							lastActivity: "2026-02-22T10:00:00Z",
						},
					],
					sessionsByNativeId: new Map([
						[
							"/Users/dev/project",
							[
								{
									sessionId: "composer:1",
									timestamp: "2026-02-21T08:00:00Z",
									slug: "composer-1",
									firstMessage: "First indexed session",
								},
								{
									sessionId: "composer:2",
									timestamp: "2026-02-22T10:00:00Z",
									slug: "composer-2",
									firstMessage: "Second indexed session",
								},
							],
						],
					]),
				},
				{
					listSessions: (_nativeId: string) => {
						listSessionsCalls += 1;
						return Effect.succeed([]);
					},
				},
			),
			testConfig,
		);

		const discovered = await runEffect(registry.discoverAllProjectsWithSessions());
		const sessions = discovered.sessionsByEncodedPath.get("-Users-dev-project") ?? [];

		expect(discovered.projects).toHaveLength(1);
		expect(sessions).toHaveLength(2);
		expect(sessions[0]?.sessionId).toBe("cursor::composer:2");
		expect(sessions[1]?.sessionId).toBe("cursor::composer:1");
		expect(listSessionsCalls).toBe(0);
	});

	test("plugin can be instantiated with explicit config rather than module mutation", () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
		const plugin = createPlugin("test-plugin", []);

		const config1 = { dataDir: "/custom/path/1" };
		const config2 = { dataDir: "/custom/path/2" };

		registry.register(plugin, config1);
		expect(registry.getPluginConfig("test-plugin").dataDir).toBe("/custom/path/1");

		// Re-register with different config
		registry.register(plugin, config2);
		expect(registry.getPluginConfig("test-plugin").dataDir).toBe("/custom/path/2");
	});

	test("registry methods can run multiple plugin effects and merge results", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("plugin-a", [
				{
					pluginId: "plugin-a",
					nativeId: "a1",
					resolvedPath: "/path/a",
					displayName: "A",
					sessionCount: 1,
					lastActivity: "2026-01-01T00:00:00Z",
				},
			]),
			{ dataDir: "/data/a" },
		);

		registry.register(
			createPlugin("plugin-b", [
				{
					pluginId: "plugin-b",
					nativeId: "b1",
					resolvedPath: "/path/b",
					displayName: "B",
					sessionCount: 2,
					lastActivity: "2026-01-02T00:00:00Z",
				},
			]),
			{ dataDir: "/data/b" },
		);

		const projects = await runEffect(registry.discoverAllProjects());
		expect(projects).toHaveLength(2);
		expect(projects[0]?.resolvedPath).toBe("/path/b"); // newest first
		expect(projects[1]?.resolvedPath).toBe("/path/a");
	});

	test("plugin failures remain isolated where current behavior expects partial success", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(createFailingPlugin("broken"), { dataDir: "/data/broken" });
		registry.register(
			createPlugin("working", [
				{
					pluginId: "working",
					nativeId: "w1",
					resolvedPath: "/path/w",
					displayName: "W",
					sessionCount: 1,
					lastActivity: "2026-01-01T00:00:00Z",
				},
			]),
			{ dataDir: "/data/working" },
		);

		// discoverAllProjects should succeed with partial results
		const projects = await runEffect(registry.discoverAllProjects());
		expect(projects).toHaveLength(1);
		expect(projects[0]?.resolvedPath).toBe("/path/w");
	});
});

describe("t3code worktree merging", () => {
	test("merges t3code worktree projects with matching main repo project", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("claude-code", [
				{
					pluginId: "claude-code",
					nativeId: "a",
					resolvedPath: "/Users/dev/Workspace/Deltro",
					displayName: "Deltro",
					sessionCount: 3,
					lastActivity: "2026-02-20T08:00:00Z",
				},
			]),
			testConfig,
		);
		registry.register(
			createPlugin("codex-cli", [
				{
					pluginId: "codex-cli",
					nativeId: "/home/.t3/worktrees/Deltro/t3code-aaa111",
					resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111",
					displayName: "Deltro",
					sessionCount: 2,
					lastActivity: "2026-02-21T08:00:00Z",
				},
				{
					pluginId: "codex-cli",
					nativeId: "/home/.t3/worktrees/Deltro/t3code-bbb222",
					resolvedPath: "/home/.t3/worktrees/Deltro/t3code-bbb222",
					displayName: "Deltro",
					sessionCount: 1,
					lastActivity: "2026-02-22T08:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(1);
		expect(merged[0]?.resolvedPath).toBe("/Users/dev/Workspace/Deltro");
		expect(merged[0]?.sessionCount).toBe(6);
		expect(merged[0]?.sources).toHaveLength(3);
	});

	test("merges t3code worktrees together when no main repo project exists", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("codex-cli", [
				{
					pluginId: "codex-cli",
					nativeId: "/home/.t3/worktrees/Deltro/t3code-aaa111",
					resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111",
					displayName: "Deltro",
					sessionCount: 2,
					lastActivity: "2026-02-21T08:00:00Z",
				},
				{
					pluginId: "codex-cli",
					nativeId: "/home/.t3/worktrees/Deltro/t3code-bbb222",
					resolvedPath: "/home/.t3/worktrees/Deltro/t3code-bbb222",
					displayName: "Deltro",
					sessionCount: 1,
					lastActivity: "2026-02-22T08:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(1);
		expect(merged[0]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
		expect(merged[0]?.sessionCount).toBe(3);
		expect(merged[0]?.sources).toHaveLength(2);
	});

	test("does not affect non-t3code projects", async () => {
		const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

		registry.register(
			createPlugin("claude-code", [
				{
					pluginId: "claude-code",
					nativeId: "a",
					resolvedPath: "/Users/dev/project-a",
					displayName: "project-a",
					sessionCount: 1,
					lastActivity: "2026-02-20T08:00:00Z",
				},
				{
					pluginId: "claude-code",
					nativeId: "b",
					resolvedPath: "/Users/dev/project-b",
					displayName: "project-b",
					sessionCount: 1,
					lastActivity: "2026-02-21T08:00:00Z",
				},
			]),
			testConfig,
		);

		const merged = await runEffect(registry.discoverAllProjects());

		expect(merged).toHaveLength(2);
		expect(merged[0]?.resolvedPath).toBe("/Users/dev/project-b");
		expect(merged[1]?.resolvedPath).toBe("/Users/dev/project-a");
	});
});

describe("encodeResolvedPath", () => {
	test("encodes unix paths with leading slash", () => {
		expect(encodeResolvedPath("/Users/dev/project")).toBe("-Users-dev-project");
	});

	test("encodes windows paths with separators and colon", () => {
		expect(encodeResolvedPath("C:\\Users\\dev\\project")).toBe("C--Users-dev-project");
	});

	test("preserves plain names except separator replacement", () => {
		expect(encodeResolvedPath("workspace/project:name")).toBe("workspace-project-name");
	});
});
