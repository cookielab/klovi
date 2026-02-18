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
