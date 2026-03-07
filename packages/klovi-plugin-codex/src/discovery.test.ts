import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { discoverCodexProjects, listCodexSessions } from "./discovery.ts";

const testDir = join(tmpdir(), `klovi-codex-discovery-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
  NodeFileSystem.layer,
  Layer.succeed(PluginConfig, { dataDir: testDir }),
);

async function writeSession(
  provider: string,
  date: string,
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): Promise<string> {
  const dir = join(testDir, "sessions", provider, date);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
  await Bun.write(filePath, lines.join("\n"));
  return filePath;
}

async function writeNewFormatSession(
  datePath: string,
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): Promise<string> {
  const dir = join(testDir, "sessions", datePath);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `rollout-${datePath.replace(/\//g, "-")}-${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
  await Bun.write(filePath, lines.join("\n"));
  return filePath;
}

beforeEach(async () => {
  await mkdir(join(testDir, "sessions"), { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("discoverCodexProjects", () => {
  test("discovers projects from session files", async () => {
    await writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      name: "Fix bug",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    await writeSession("openai", "2025-01-16", "uuid-2", {
      uuid: "uuid-2",
      name: "Add feature",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const projects = await Effect.runPromise(
      discoverCodexProjects().pipe(Effect.provide(testLayer)),
    );

    expect(projects).toHaveLength(1);
    expect(projects[0]?.pluginId).toBe("codex-cli");
    expect(projects[0]?.nativeId).toBe("/Users/dev/project-a");
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");
    expect(projects[0]?.sessionCount).toBe(2);
  });

  test("groups sessions by cwd into separate projects", async () => {
    await writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    await writeSession("openai", "2025-01-15", "uuid-2", {
      uuid: "uuid-2",
      cwd: "/Users/dev/project-b",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const projects = await Effect.runPromise(
      discoverCodexProjects().pipe(Effect.provide(testLayer)),
    );

    expect(projects).toHaveLength(2);
    const paths = projects.map((p) => p.resolvedPath).sort();
    expect(paths).toEqual(["/Users/dev/project-a", "/Users/dev/project-b"]);
  });

  test("returns empty array when no sessions exist", async () => {
    const projects = await Effect.runPromise(
      discoverCodexProjects().pipe(Effect.provide(testLayer)),
    );
    expect(projects).toEqual([]);
  });

  test("skips files with malformed first line", async () => {
    const dir = join(testDir, "sessions", "openai", "2025-01-15");
    await mkdir(dir, { recursive: true });
    await Bun.write(join(dir, "bad-uuid.jsonl"), "not valid json\n");

    const projects = await Effect.runPromise(
      discoverCodexProjects().pipe(Effect.provide(testLayer)),
    );
    expect(projects).toEqual([]);
  });

  test("handles multiple providers", async () => {
    await writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    await writeSession("anthropic", "2025-01-15", "uuid-2", {
      uuid: "uuid-2",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "claude-4",
      provider_id: "anthropic",
    });

    const projects = await Effect.runPromise(
      discoverCodexProjects().pipe(Effect.provide(testLayer)),
    );

    // Same cwd from different providers should merge into one project
    expect(projects).toHaveLength(1);
    expect(projects[0]?.sessionCount).toBe(2);
  });
});

describe("listCodexSessions", () => {
  test("lists sessions matching a project cwd", async () => {
    await writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      name: "Fix the login bug",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    await writeSession("openai", "2025-01-16", "uuid-2", {
      uuid: "uuid-2",
      name: "Add tests",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    // Different project, should not be included
    await writeSession("openai", "2025-01-15", "uuid-3", {
      uuid: "uuid-3",
      name: "Other project",
      cwd: "/Users/dev/project-b",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await Effect.runPromise(
      listCodexSessions("/Users/dev/project-a").pipe(Effect.provide(testLayer)),
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.sessionId).toBe("uuid-2"); // newer first
    expect(sessions[1]?.sessionId).toBe("uuid-1");
    expect(sessions[0]?.pluginId).toBe("codex-cli");
    expect(sessions[0]?.firstMessage).toBe("Add tests");
    expect(sessions[0]?.model).toBe("o4-mini");
  });

  test("uses first agent_message when name is empty", async () => {
    await writeSession(
      "openai",
      "2025-01-15",
      "uuid-1",
      {
        uuid: "uuid-1",
        cwd: "/Users/dev/project-a",
        timestamps: { created: 1706000000, updated: 1706001000 },
        model: "o4-mini",
        provider_id: "openai",
      },
      [
        { type: "turn.started" },
        {
          type: "item.completed",
          item: { type: "agent_message", text: "I'll help you fix the bug" },
        },
      ],
    );

    const sessions = await Effect.runPromise(
      listCodexSessions("/Users/dev/project-a").pipe(Effect.provide(testLayer)),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.firstMessage).toBe("I'll help you fix the bug");
  });

  test("falls back to default message when no name or agent_message", async () => {
    await writeSession(
      "openai",
      "2025-01-15",
      "uuid-1",
      {
        uuid: "uuid-1",
        cwd: "/Users/dev/project-a",
        timestamps: { created: 1706000000, updated: 1706001000 },
        model: "o4-mini",
        provider_id: "openai",
      },
      [{ type: "turn.started" }, { type: "turn.completed" }],
    );

    const sessions = await Effect.runPromise(
      listCodexSessions("/Users/dev/project-a").pipe(Effect.provide(testLayer)),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.firstMessage).toBe("Codex session");
  });

  test("returns empty for non-matching cwd", async () => {
    await writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await Effect.runPromise(
      listCodexSessions("/Users/dev/nonexistent").pipe(Effect.provide(testLayer)),
    );
    expect(sessions).toEqual([]);
  });

  test("sessions sorted by timestamp descending", async () => {
    await writeSession("openai", "2025-01-15", "uuid-old", {
      uuid: "uuid-old",
      name: "Old session",
      cwd: "/Users/dev/project",
      timestamps: { created: 1700000000, updated: 1700001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    await writeSession("openai", "2025-01-16", "uuid-new", {
      uuid: "uuid-new",
      name: "New session",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await Effect.runPromise(
      listCodexSessions("/Users/dev/project").pipe(Effect.provide(testLayer)),
    );

    expect(sessions[0]?.sessionId).toBe("uuid-new");
    expect(sessions[1]?.sessionId).toBe("uuid-old");
  });
});

describe("new envelope format", () => {
  describe("discoverCodexProjects", () => {
    test("discovers projects from new-format session files", async () => {
      await writeNewFormatSession("2026/02/18", "new-uuid-1", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "new-uuid-1",
          cwd: "/Users/dev/new-project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
          originator: "Codex Desktop",
        },
      });

      const projects = await Effect.runPromise(
        discoverCodexProjects().pipe(Effect.provide(testLayer)),
      );

      expect(projects).toHaveLength(1);
      expect(projects[0]?.pluginId).toBe("codex-cli");
      expect(projects[0]?.nativeId).toBe("/Users/dev/new-project");
      expect(projects[0]?.sessionCount).toBe(1);
    });

    test("mixes old and new format sessions into same project", async () => {
      await writeSession("openai", "2025-01-15", "old-uuid", {
        uuid: "old-uuid",
        cwd: "/Users/dev/project",
        timestamps: { created: 1706000000, updated: 1706001000 },
        model: "o4-mini",
        provider_id: "openai",
      });

      await writeNewFormatSession("2026/02/18", "new-uuid", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "new-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      });

      const projects = await Effect.runPromise(
        discoverCodexProjects().pipe(Effect.provide(testLayer)),
      );

      expect(projects).toHaveLength(1);
      expect(projects[0]?.sessionCount).toBe(2);
    });
  });

  describe("listCodexSessions", () => {
    test("lists new-format sessions", async () => {
      await writeNewFormatSession("2026/02/18", "new-uuid-1", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "new-uuid-1",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
          model: "o4-mini",
        },
      });

      const sessions = await Effect.runPromise(
        listCodexSessions("/Users/dev/project").pipe(Effect.provide(testLayer)),
      );

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.sessionId).toBe("new-uuid-1");
      expect(sessions[0]?.pluginId).toBe("codex-cli");
      expect(sessions[0]?.model).toBe("o4-mini");
    });

    test("extracts first user message from new-format event_msg", async () => {
      await writeNewFormatSession(
        "2026/02/18",
        "msg-uuid",
        {
          type: "session_meta",
          timestamp: "2026-02-18T10:00:00.000Z",
          payload: {
            id: "msg-uuid",
            cwd: "/Users/dev/project",
            timestamp: "2026-02-18T10:00:00.000Z",
            model_provider: "openai",
          },
        },
        [
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:01.000Z",
            payload: { type: "user_message", message: "Fix the login bug" },
          },
          {
            type: "event_msg",
            timestamp: "2026-02-18T10:00:02.000Z",
            payload: { type: "agent_message", message: "I'll look into it" },
          },
        ],
      );

      const sessions = await Effect.runPromise(
        listCodexSessions("/Users/dev/project").pipe(Effect.provide(testLayer)),
      );

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.firstMessage).toBe("Fix the login bug");
    });

    test("falls back to Codex session when no messages in new format", async () => {
      await writeNewFormatSession("2026/02/18", "empty-uuid", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "empty-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      });

      const sessions = await Effect.runPromise(
        listCodexSessions("/Users/dev/project").pipe(Effect.provide(testLayer)),
      );

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.firstMessage).toBe("Codex session");
    });
  });
});
