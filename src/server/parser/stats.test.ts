import { afterEach, describe, expect, test } from "bun:test";
import type { ToolPlugin } from "../../shared/plugin-types.ts";
import type { Session, SessionSummary } from "../../shared/types.ts";
import { PluginRegistry } from "../plugin-registry.ts";
import { clearStatsCacheForTests, scanStats } from "./stats.ts";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

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
    project,
    pluginId: "mock-plugin",
    turns: [
      {
        kind: "user",
        uuid: `${id}-user`,
        timestamp,
        text: "hello",
      },
      {
        kind: "assistant",
        uuid: `${id}-assistant`,
        timestamp,
        model,
        usage: {
          inputTokens,
          outputTokens,
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
    discoverProjects: async () => [
      {
        pluginId: "mock-plugin",
        nativeId: "project-1",
        resolvedPath: "/tmp/project-1",
        displayName: "project-1",
        sessionCount: list.length,
        lastActivity: list[0]?.timestamp ?? "",
      },
    ],
    listSessions: async () => list,
    loadSession: async (_nativeId, sessionId) => {
      if (options?.failLoad) throw new Error("load failed");
      const session = sessionsById[sessionId];
      if (!session) throw new Error("missing session");
      return session;
    },
  };
}

afterEach(() => {
  clearStatsCacheForTests();
});

describe("scanStats", () => {
  test("aggregates multi-tool style stats from registry sessions", async () => {
    const registry = new PluginRegistry();

    const s1 = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 100, 40);
    const s2 = makeSession("s2", "project-1", isoDaysAgo(8), "gpt-5", 60, 20);

    const list: SessionSummary[] = [
      {
        sessionId: "s1",
        timestamp: s1.turns[0]!.timestamp,
        slug: "s1",
        firstMessage: "session 1",
        model: "claude-opus",
        gitBranch: "main",
      },
      {
        sessionId: "s2",
        timestamp: s2.turns[0]!.timestamp,
        slug: "s2",
        firstMessage: "session 2",
        model: "gpt-5",
        gitBranch: "main",
      },
    ];

    registry.register(createMockPlugin({ s1, s2 }, list));

    const stats = await scanStats(registry);
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

    registry.register(createMockPlugin({}, list, { failLoad: true }));

    const stats = await scanStats(registry);
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(1);
    expect(stats.messages).toBe(0);
    expect(stats.inputTokens).toBe(0);
  });

  test("uses in-memory cache between calls", async () => {
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
    );

    const first = await scanStats(registry);
    expect(first.inputTokens).toBe(10);

    session = makeSession("s1", "project-1", isoDaysAgo(0), "claude-opus", 999, 5);
    const second = await scanStats(registry);
    expect(second.inputTokens).toBe(10);

    clearStatsCacheForTests();
    registry.register(
      createMockPlugin(
        {
          s1: session,
        },
        list,
      ),
    );

    const third = await scanStats(registry);
    expect(third.inputTokens).toBe(999);
  });
});
