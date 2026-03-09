import { describe, expect, test } from "bun:test";
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { PluginError, type SessionSummary, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { MergedProject, PluginProject, ToolPlugin } from "./plugin-types.ts";
import { PluginRegistry } from "./registry.ts";

const testConfig = { dataDir: "/test" };
const testLayer = Layer.merge(
  NodeFileSystem.layer,
  Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);
const runEffect = <A>(effect: Effect.Effect<A, never, RegistryRequirements>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

function createMockPlugin(
  id: string,
  projects: PluginProject[],
  sessions?: Record<string, SessionSummary[]>,
): ToolPlugin {
  return {
    id,
    displayName: id,
    getDefaultDataDir: () => null,
    isDataAvailable: Effect.succeed(true),
    discoverProjects: Effect.succeed(projects),
    listSessions: (nativeId: string) => Effect.succeed(sessions?.[nativeId] ?? []),
    loadSession: (_nativeId: string, sessionId: string) =>
      Effect.succeed({
        sessionId,
        project: "",
        turns: [],
      }),
  };
}

function createFailingPlugin(id: string): ToolPlugin {
  return {
    id,
    displayName: id,
    getDefaultDataDir: () => null,
    isDataAvailable: Effect.succeed(false),
    discoverProjects: Effect.fail(
      new PluginError({ pluginId: id, operation: "discover", message: "Discovery failed" }),
    ),
    listSessions: () =>
      Effect.fail(
        new PluginError({
          pluginId: id,
          operation: "listSessions",
          message: "Session listing failed",
        }),
      ),
    loadSession: (_nativeId: string, sessionId: string) =>
      Effect.succeed({
        sessionId,
        project: "",
        turns: [],
      }),
  };
}

describe("PluginRegistry", () => {
  test("register and retrieve a plugin", () => {
    const registry = new PluginRegistry();
    const plugin = createMockPlugin("test-plugin", []);

    registry.register(plugin, testConfig);

    expect(registry.getPlugin("test-plugin")).toBe(plugin);
  });

  test("getAllPlugins returns all registered", () => {
    const registry = new PluginRegistry();
    const plugin1 = createMockPlugin("plugin-a", []);
    const plugin2 = createMockPlugin("plugin-b", []);

    registry.register(plugin1, testConfig);
    registry.register(plugin2, testConfig);

    const all = registry.getAllPlugins();
    expect(all).toHaveLength(2);
    expect(all).toContain(plugin1);
    expect(all).toContain(plugin2);
  });

  test("getPlugin throws for unknown id", () => {
    const registry = new PluginRegistry();

    expect(() => registry.getPlugin("nonexistent")).toThrow("Plugin not found: nonexistent");
  });

  test("discoverAllProjects merges by resolvedPath", async () => {
    const registry = new PluginRegistry();

    const pluginA = createMockPlugin("plugin-a", [
      {
        pluginId: "plugin-a",
        nativeId: "native-a",
        resolvedPath: "/Users/foo/project",
        displayName: "project",
        sessionCount: 3,
        lastActivity: "2025-01-01T00:00:00Z",
      },
    ]);
    const pluginB = createMockPlugin("plugin-b", [
      {
        pluginId: "plugin-b",
        nativeId: "native-b",
        resolvedPath: "/Users/foo/project",
        displayName: "project",
        sessionCount: 5,
        lastActivity: "2025-01-02T00:00:00Z",
      },
    ]);

    registry.register(pluginA, testConfig);
    registry.register(pluginB, testConfig);

    const projects = await runEffect(registry.discoverAllProjects());
    expect(projects).toHaveLength(1);

    const merged = projects[0];
    expect(merged?.resolvedPath).toBe("/Users/foo/project");
    expect(merged?.sessionCount).toBe(8);
    expect(merged?.lastActivity).toBe("2025-01-02T00:00:00Z");
    expect(merged?.encodedPath).toBe("-Users-foo-project");
    expect(merged?.sources).toHaveLength(2);
    expect(merged?.sources).toContainEqual({ pluginId: "plugin-a", nativeId: "native-a" });
    expect(merged?.sources).toContainEqual({ pluginId: "plugin-b", nativeId: "native-b" });
  });

  test("discoverAllProjects keeps separate paths separate", async () => {
    const registry = new PluginRegistry();

    const plugin = createMockPlugin("plugin-a", [
      {
        pluginId: "plugin-a",
        nativeId: "native-1",
        resolvedPath: "/Users/foo/project-one",
        displayName: "project-one",
        sessionCount: 2,
        lastActivity: "2025-01-01T00:00:00Z",
      },
      {
        pluginId: "plugin-a",
        nativeId: "native-2",
        resolvedPath: "/Users/foo/project-two",
        displayName: "project-two",
        sessionCount: 4,
        lastActivity: "2025-01-03T00:00:00Z",
      },
    ]);

    registry.register(plugin, testConfig);

    const projects = await runEffect(registry.discoverAllProjects());
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.resolvedPath)).toContain("/Users/foo/project-one");
    expect(projects.map((p) => p.resolvedPath)).toContain("/Users/foo/project-two");
  });

  test("discoverAllProjects sorts by lastActivity descending", async () => {
    const registry = new PluginRegistry();

    const plugin = createMockPlugin("plugin-a", [
      {
        pluginId: "plugin-a",
        nativeId: "native-old",
        resolvedPath: "/Users/foo/old-project",
        displayName: "old-project",
        sessionCount: 1,
        lastActivity: "2024-06-01T00:00:00Z",
      },
      {
        pluginId: "plugin-a",
        nativeId: "native-new",
        resolvedPath: "/Users/foo/new-project",
        displayName: "new-project",
        sessionCount: 1,
        lastActivity: "2025-03-15T00:00:00Z",
      },
      {
        pluginId: "plugin-a",
        nativeId: "native-mid",
        resolvedPath: "/Users/foo/mid-project",
        displayName: "mid-project",
        sessionCount: 1,
        lastActivity: "2025-01-10T00:00:00Z",
      },
    ]);

    registry.register(plugin, testConfig);

    const projects = await runEffect(registry.discoverAllProjects());
    expect(projects).toHaveLength(3);
    expect(projects[0]?.resolvedPath).toBe("/Users/foo/new-project");
    expect(projects[1]?.resolvedPath).toBe("/Users/foo/mid-project");
    expect(projects[2]?.resolvedPath).toBe("/Users/foo/old-project");
  });

  test("discoverAllProjects handles plugin discovery failure", async () => {
    const registry = new PluginRegistry();

    const failingPlugin = createFailingPlugin("failing-plugin");
    const workingPlugin = createMockPlugin("working-plugin", [
      {
        pluginId: "working-plugin",
        nativeId: "native-ok",
        resolvedPath: "/Users/foo/working",
        displayName: "working",
        sessionCount: 7,
        lastActivity: "2025-02-01T00:00:00Z",
      },
    ]);

    registry.register(failingPlugin, testConfig);
    registry.register(workingPlugin, testConfig);

    const projects = await runEffect(registry.discoverAllProjects());
    expect(projects).toHaveLength(1);
    expect(projects[0]?.resolvedPath).toBe("/Users/foo/working");
  });

  test("listAllSessions aggregates from all sources with pluginId", async () => {
    const registry = new PluginRegistry();

    const pluginA = createMockPlugin(
      "plugin-a",
      [
        {
          pluginId: "plugin-a",
          nativeId: "native-a",
          resolvedPath: "/Users/foo/project",
          displayName: "project",
          sessionCount: 2,
          lastActivity: "2025-01-02T00:00:00Z",
        },
      ],
      {
        "native-a": [
          {
            sessionId: "session-1",
            timestamp: "2025-01-01T10:00:00Z",
            slug: "session-1",
            firstMessage: "Hello from A",
            model: "claude",
            gitBranch: "main",
            pluginId: "plugin-a",
          },
          {
            sessionId: "session-2",
            timestamp: "2025-01-02T10:00:00Z",
            slug: "session-2",
            firstMessage: "Second from A",
            model: "claude",
            gitBranch: "main",
            pluginId: "plugin-a",
          },
        ],
      },
    );

    const pluginB = createMockPlugin(
      "plugin-b",
      [
        {
          pluginId: "plugin-b",
          nativeId: "native-b",
          resolvedPath: "/Users/foo/project",
          displayName: "project",
          sessionCount: 1,
          lastActivity: "2025-01-03T00:00:00Z",
        },
      ],
      {
        "native-b": [
          {
            sessionId: "session-3",
            timestamp: "2025-01-03T10:00:00Z",
            slug: "session-3",
            firstMessage: "Hello from B",
            model: "gpt-4",
            gitBranch: "feature",
            pluginId: "plugin-b",
          },
        ],
      },
    );

    registry.register(pluginA, testConfig);
    registry.register(pluginB, testConfig);

    const projects = await runEffect(registry.discoverAllProjects());
    expect(projects).toHaveLength(1);

    const project = projects[0] as MergedProject;
    const sessions = await runEffect(registry.listAllSessions(project));
    expect(sessions).toHaveLength(3);

    // Sorted by timestamp descending
    expect(sessions[0]?.sessionId).toBe("plugin-b::session-3");
    expect(sessions[0]?.timestamp).toBe("2025-01-03T10:00:00Z");
    expect(sessions[1]?.sessionId).toBe("plugin-a::session-2");
    expect(sessions[1]?.timestamp).toBe("2025-01-02T10:00:00Z");
    expect(sessions[2]?.sessionId).toBe("plugin-a::session-1");
    expect(sessions[2]?.timestamp).toBe("2025-01-01T10:00:00Z");
  });

  test("listAllSessions handles plugin failure gracefully", async () => {
    const registry = new PluginRegistry();

    const workingPlugin = createMockPlugin("working-plugin", [], {
      "native-ok": [
        {
          sessionId: "session-ok",
          timestamp: "2025-01-01T10:00:00Z",
          slug: "session-ok",
          firstMessage: "Works fine",
          model: "claude",
          gitBranch: "main",
          pluginId: "working-plugin",
        },
      ],
    });
    const failingPlugin = createFailingPlugin("failing-plugin");

    registry.register(workingPlugin, testConfig);
    registry.register(failingPlugin, testConfig);

    const mergedProject = {
      encodedPath: "-Users-foo-project",
      resolvedPath: "/Users/foo/project",
      name: "/Users/foo/project",
      fullPath: "/Users/foo/project",
      sessionCount: 1,
      lastActivity: "2025-01-01T10:00:00Z",
      sources: [
        { pluginId: "working-plugin", nativeId: "native-ok" },
        { pluginId: "failing-plugin", nativeId: "native-fail" },
      ],
    };

    const sessions = await runEffect(registry.listAllSessions(mergedProject));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe("working-plugin::session-ok");
  });
});
