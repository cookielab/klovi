import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getOpenCodeDir, openCodePlugin, setOpenCodeDir } from "./index.ts";

const testDir = join(tmpdir(), `klovi-opencode-index-test-${Date.now()}`);

function createDbWithSingleSession(): void {
  const dbPath = join(testDir, "opencode.db");
  const db = new Database(dbPath, { create: true });

  db.run(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT NOT NULL,
      name TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      sandboxes TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.run(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      title TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT 'v2',
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(
    "INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes) VALUES (?, ?, ?, ?, ?, '[]')",
    ["project-1", "/Users/dev/opencode-project", "OpenCode Project", 1706000000000, 1706001000000],
  );

  db.run(
    "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, 'v2', ?, ?)",
    [
      "session-1",
      "project-1",
      "session-1",
      "/Users/dev/opencode-project",
      "",
      1706000000000,
      1706001000000,
    ],
  );

  db.run(
    "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
    [
      "msg-1",
      "session-1",
      1706000000000,
      1706000000000,
      JSON.stringify({ role: "user", time: { created: 1706000000000 } }),
    ],
  );

  db.run(
    "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
    [
      "part-1",
      "msg-1",
      "session-1",
      1706000000001,
      1706000000001,
      JSON.stringify({ type: "text", text: "Please help me debug" }),
    ],
  );

  db.run(
    "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
    [
      "msg-2",
      "session-1",
      1706000001000,
      1706000001000,
      JSON.stringify({ role: "assistant", modelID: "gpt-5", finish: "stop" }),
    ],
  );

  db.run(
    "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
    [
      "part-2",
      "msg-2",
      "session-1",
      1706000001001,
      1706000001001,
      JSON.stringify({ type: "text", text: "Sure, I can help." }),
    ],
  );

  db.close();
}

describe("openCodePlugin", () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = getOpenCodeDir();
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    setOpenCodeDir(testDir);
  });

  afterEach(() => {
    setOpenCodeDir(originalDir);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("exposes plugin identity and no resume command", () => {
    expect(openCodePlugin.id).toBe("opencode");
    expect(openCodePlugin.displayName).toBe("OpenCode");
    expect(openCodePlugin.getDefaultDataDir()).toBe(testDir);
    expect("getResumeCommand" in openCodePlugin).toBe(false);
  });

  test("discovers, lists, and loads sessions through plugin interface", async () => {
    createDbWithSingleSession();

    const projects = await openCodePlugin.discoverProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.nativeId).toBe("project-1");
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/opencode-project");

    const sessions = await openCodePlugin.listSessions("project-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.pluginId).toBe("opencode");
    expect(sessions[0]?.firstMessage).toBe("Please help me debug");

    const session = await openCodePlugin.loadSession("project-1", "session-1");
    expect(session.pluginId).toBe("opencode");
    expect(session.project).toBe("/Users/dev/opencode-project");
    expect(session.turns).toHaveLength(2);
  });

  test("returns empty discovery/list results when db is missing", async () => {
    const projects = await openCodePlugin.discoverProjects();
    const sessions = await openCodePlugin.listSessions("project-1");

    expect(projects).toEqual([]);
    expect(sessions).toEqual([]);
  });
});
