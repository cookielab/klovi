import { describe, expect, test } from "bun:test";
import { encodeResolvedPath, PluginRegistry } from "./plugin-registry.ts";
import type {
  PluginProject,
  RegistrySession,
  RegistrySessionSummary,
  ToolPlugin,
} from "./plugin-types.ts";

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
    id,
    displayName: id,
    getDefaultDataDir: () => null,
    discoverProjects: async () => projects,
    listSessions: async (nativeId: string) => sessionsByNativeId[nativeId] ?? [],
    loadSession: async (_nativeId: string, sessionId: string) => ({
      sessionId,
      turns: [],
    }),
  };
}

function createFailingPlugin(id: string): ToolPlugin<string, TestSessionSummary, TestSession> {
  return {
    id,
    displayName: id,
    getDefaultDataDir: () => null,
    discoverProjects: async () => Promise.reject(new Error("discovery failed")),
    listSessions: async () => Promise.reject(new Error("list failed")),
    loadSession: async (_nativeId: string, sessionId: string) => ({
      sessionId,
      turns: [],
    }),
  };
}

describe("PluginRegistry", () => {
  test("register and getPlugin", () => {
    const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
    const plugin = createPlugin("claude-code", []);

    registry.register(plugin);

    expect(registry.getPlugin("claude-code")).toBe(plugin);
  });

  test("registering the same plugin id replaces previous plugin", () => {
    const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();
    const first = createPlugin("codex-cli", []);
    const second = createPlugin("codex-cli", []);

    registry.register(first);
    registry.register(second);

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
    );

    const merged = await registry.discoverAllProjects();

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
    );

    const merged = await registry.discoverAllProjects();

    expect(merged).toHaveLength(2);
    expect(merged[0]?.resolvedPath).toBe("/Users/dev/newer");
    expect(merged[1]?.resolvedPath).toBe("/Users/dev/older");
  });

  test("discoverAllProjects tolerates per-plugin discovery failures", async () => {
    const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

    registry.register(createFailingPlugin("broken"));
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
    );

    const merged = await registry.discoverAllProjects();

    expect(merged).toHaveLength(1);
    expect(merged[0]?.resolvedPath).toBe("/Users/dev/project");
  });

  test("discoverAllProjects with no plugins returns empty list", async () => {
    const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

    const merged = await registry.discoverAllProjects();

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
    );

    const sessions = await registry.listAllSessions({
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
    });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.sessionId).toBe("codex-cli::session-2");
    expect(sessions[0]?.pluginId).toBe("codex-cli");
    expect(sessions[1]?.sessionId).toBe("claude-code::session-1");
    expect(sessions[1]?.pluginId).toBe("claude-code");
  });

  test("listAllSessions skips missing plugins and failing sources", async () => {
    const registry = new PluginRegistry<string, TestSessionSummary, TestSession>();

    registry.register(createFailingPlugin("broken"));
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
    );

    const sessions = await registry.listAllSessions({
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
    });

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
    );

    const sessions = await registry.listAllSessions({
      encodedPath: "-Users-dev-project",
      resolvedPath: "/Users/dev/project",
      name: "/Users/dev/project",
      fullPath: "/Users/dev/project",
      sessionCount: 1,
      lastActivity: "2026-02-21T08:00:00Z",
      sources: [{ pluginId: "claude-code", nativeId: "a" }],
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe("claude-code/abc");
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
