import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setCodexCliDir } from "../../config.ts";
import { discoverCodexProjects, listCodexSessions } from "./discovery.ts";

const testDir = join(tmpdir(), `klovi-codex-discovery-test-${Date.now()}`);

function writeSession(
  provider: string,
  date: string,
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): string {
  const dir = join(testDir, "sessions", provider, date);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
  writeFileSync(filePath, lines.join("\n"));
  return filePath;
}

function writeNewFormatSession(
  datePath: string,
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): string {
  const dir = join(testDir, "sessions", datePath);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `rollout-${datePath.replace(/\//g, "-")}-${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((e) => JSON.stringify(e))];
  writeFileSync(filePath, lines.join("\n"));
  return filePath;
}

beforeEach(() => {
  mkdirSync(join(testDir, "sessions"), { recursive: true });
  setCodexCliDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("discoverCodexProjects", () => {
  test("discovers projects from session files", async () => {
    writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      name: "Fix bug",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    writeSession("openai", "2025-01-16", "uuid-2", {
      uuid: "uuid-2",
      name: "Add feature",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const projects = await discoverCodexProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]!.pluginId).toBe("codex-cli");
    expect(projects[0]!.nativeId).toBe("/Users/dev/project-a");
    expect(projects[0]!.resolvedPath).toBe("/Users/dev/project-a");
    expect(projects[0]!.sessionCount).toBe(2);
  });

  test("groups sessions by cwd into separate projects", async () => {
    writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    writeSession("openai", "2025-01-15", "uuid-2", {
      uuid: "uuid-2",
      cwd: "/Users/dev/project-b",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const projects = await discoverCodexProjects();

    expect(projects).toHaveLength(2);
    const paths = projects.map((p) => p.resolvedPath).sort();
    expect(paths).toEqual(["/Users/dev/project-a", "/Users/dev/project-b"]);
  });

  test("returns empty array when no sessions exist", async () => {
    const projects = await discoverCodexProjects();
    expect(projects).toEqual([]);
  });

  test("skips files with malformed first line", async () => {
    const dir = join(testDir, "sessions", "openai", "2025-01-15");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad-uuid.jsonl"), "not valid json\n");

    const projects = await discoverCodexProjects();
    expect(projects).toEqual([]);
  });

  test("handles multiple providers", async () => {
    writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    writeSession("anthropic", "2025-01-15", "uuid-2", {
      uuid: "uuid-2",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "claude-4",
      provider_id: "anthropic",
    });

    const projects = await discoverCodexProjects();

    // Same cwd from different providers should merge into one project
    expect(projects).toHaveLength(1);
    expect(projects[0]!.sessionCount).toBe(2);
  });
});

describe("listCodexSessions", () => {
  test("lists sessions matching a project cwd", async () => {
    writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      name: "Fix the login bug",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    writeSession("openai", "2025-01-16", "uuid-2", {
      uuid: "uuid-2",
      name: "Add tests",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706100000, updated: 1706101000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    // Different project, should not be included
    writeSession("openai", "2025-01-15", "uuid-3", {
      uuid: "uuid-3",
      name: "Other project",
      cwd: "/Users/dev/project-b",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await listCodexSessions("/Users/dev/project-a");

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.sessionId).toBe("uuid-2"); // newer first
    expect(sessions[1]!.sessionId).toBe("uuid-1");
    expect(sessions[0]!.pluginId).toBe("codex-cli");
    expect(sessions[0]!.firstMessage).toBe("Add tests");
    expect(sessions[0]!.model).toBe("o4-mini");
  });

  test("uses first agent_message when name is empty", async () => {
    writeSession(
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

    const sessions = await listCodexSessions("/Users/dev/project-a");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.firstMessage).toBe("I'll help you fix the bug");
  });

  test("falls back to default message when no name or agent_message", async () => {
    writeSession(
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

    const sessions = await listCodexSessions("/Users/dev/project-a");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.firstMessage).toBe("Codex session");
  });

  test("returns empty for non-matching cwd", async () => {
    writeSession("openai", "2025-01-15", "uuid-1", {
      uuid: "uuid-1",
      cwd: "/Users/dev/project-a",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await listCodexSessions("/Users/dev/nonexistent");
    expect(sessions).toEqual([]);
  });

  test("sessions sorted by timestamp descending", async () => {
    writeSession("openai", "2025-01-15", "uuid-old", {
      uuid: "uuid-old",
      name: "Old session",
      cwd: "/Users/dev/project",
      timestamps: { created: 1700000000, updated: 1700001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    writeSession("openai", "2025-01-16", "uuid-new", {
      uuid: "uuid-new",
      name: "New session",
      cwd: "/Users/dev/project",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    });

    const sessions = await listCodexSessions("/Users/dev/project");

    expect(sessions[0]!.sessionId).toBe("uuid-new");
    expect(sessions[1]!.sessionId).toBe("uuid-old");
  });
});

describe("new envelope format", () => {
  describe("discoverCodexProjects", () => {
    test("discovers projects from new-format session files", async () => {
      writeNewFormatSession("2026/02/18", "new-uuid-1", {
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

      const projects = await discoverCodexProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]!.pluginId).toBe("codex-cli");
      expect(projects[0]!.nativeId).toBe("/Users/dev/new-project");
      expect(projects[0]!.sessionCount).toBe(1);
    });

    test("mixes old and new format sessions into same project", async () => {
      writeSession("openai", "2025-01-15", "old-uuid", {
        uuid: "old-uuid",
        cwd: "/Users/dev/project",
        timestamps: { created: 1706000000, updated: 1706001000 },
        model: "o4-mini",
        provider_id: "openai",
      });

      writeNewFormatSession("2026/02/18", "new-uuid", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "new-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      });

      const projects = await discoverCodexProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]!.sessionCount).toBe(2);
    });
  });

  describe("listCodexSessions", () => {
    test("lists new-format sessions", async () => {
      writeNewFormatSession("2026/02/18", "new-uuid-1", {
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

      const sessions = await listCodexSessions("/Users/dev/project");

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.sessionId).toBe("new-uuid-1");
      expect(sessions[0]!.pluginId).toBe("codex-cli");
      expect(sessions[0]!.model).toBe("o4-mini");
    });

    test("extracts first user message from new-format event_msg", async () => {
      writeNewFormatSession(
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

      const sessions = await listCodexSessions("/Users/dev/project");

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.firstMessage).toBe("Fix the login bug");
    });

    test("falls back to Codex session when no messages in new format", async () => {
      writeNewFormatSession("2026/02/18", "empty-uuid", {
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "empty-uuid",
          cwd: "/Users/dev/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
        },
      });

      const sessions = await listCodexSessions("/Users/dev/project");

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.firstMessage).toBe("Codex session");
    });
  });
});
