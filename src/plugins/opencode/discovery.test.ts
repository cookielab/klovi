import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setOpenCodeDir } from "../config.ts";
import { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery.ts";

const testDir = join(tmpdir(), `klovi-opencode-discovery-test-${Date.now()}`);

function createTestDb(): Database {
  const dbPath = join(testDir, "opencode.db");
  const db = new Database(dbPath, { create: true });

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

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
      project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
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
      session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  return db;
}

function insertProject(
  db: Database,
  id: string,
  worktree: string,
  name: string | null = null,
): void {
  const now = Date.now();
  db.run(
    "INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes) VALUES (?, ?, ?, ?, ?, '[]')",
    [id, worktree, name, now, now],
  );
}

function insertSession(
  db: Database,
  id: string,
  projectId: string,
  opts: { title?: string; directory?: string; timeCreated?: number } = {},
): void {
  const now = Date.now();
  db.run(
    "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, 'v2', ?, ?)",
    [
      id,
      projectId,
      id,
      opts.directory || "/Users/dev/project",
      opts.title || "",
      opts.timeCreated || now,
      opts.timeCreated || now,
    ],
  );
}

function insertMessage(
  db: Database,
  id: string,
  sessionId: string,
  data: Record<string, unknown>,
  timeCreated?: number,
): void {
  const now = timeCreated || Date.now();
  db.run(
    "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
    [id, sessionId, now, now, JSON.stringify(data)],
  );
}

function insertPart(
  db: Database,
  id: string,
  messageId: string,
  sessionId: string,
  data: Record<string, unknown>,
): void {
  const now = Date.now();
  db.run(
    "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
    [id, messageId, sessionId, now, now, JSON.stringify(data)],
  );
}

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
  setOpenCodeDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("discoverOpenCodeProjects", () => {
  test("discovers projects from project table", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a", "Project A");
    insertSession(db, "sess-1", "proj-1", { directory: "/Users/dev/project-a" });
    insertSession(db, "sess-2", "proj-1", { directory: "/Users/dev/project-a" });
    db.close();

    const projects = await discoverOpenCodeProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.pluginId).toBe("opencode");
    expect(projects[0]?.nativeId).toBe("proj-1");
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");
    expect(projects[0]?.displayName).toBe("Project A");
    expect(projects[0]?.sessionCount).toBe(2);
  });

  test("discovers multiple projects", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a", "Project A");
    insertProject(db, "proj-2", "/Users/dev/project-b", "Project B");
    insertSession(db, "sess-1", "proj-1", { directory: "/Users/dev/project-a" });
    insertSession(db, "sess-2", "proj-2", { directory: "/Users/dev/project-b" });
    db.close();

    const projects = await discoverOpenCodeProjects();

    expect(projects).toHaveLength(2);
    const paths = projects.map((p) => p.resolvedPath).sort();
    expect(paths).toEqual(["/Users/dev/project-a", "/Users/dev/project-b"]);
  });

  test("returns empty array when DB does not exist", async () => {
    // Don't create the DB file
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });

    const projects = await discoverOpenCodeProjects();
    expect(projects).toEqual([]);
  });

  test("returns empty array when DB has unexpected schema", async () => {
    const dbPath = join(testDir, "opencode.db");
    const db = new Database(dbPath, { create: true });
    db.run("CREATE TABLE some_random_table (id TEXT PRIMARY KEY)");
    db.close();

    const projects = await discoverOpenCodeProjects();
    expect(projects).toEqual([]);
  });

  test("skips projects with no sessions", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a", "Project A");
    insertProject(db, "proj-2", "/Users/dev/project-b", "Project B");
    // Only add sessions for project A
    insertSession(db, "sess-1", "proj-1", { directory: "/Users/dev/project-a" });
    db.close();

    const projects = await discoverOpenCodeProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.nativeId).toBe("proj-1");
  });

  test("uses worktree as display name when name is null", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a", null);
    insertSession(db, "sess-1", "proj-1", { directory: "/Users/dev/project-a" });
    db.close();

    const projects = await discoverOpenCodeProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.displayName).toBe("/Users/dev/project-a");
  });
});

describe("listOpenCodeSessions", () => {
  test("lists sessions for a project", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a");
    insertSession(db, "sess-1", "proj-1", {
      title: "Fix the login bug",
      directory: "/Users/dev/project-a",
      timeCreated: 1706000000,
    });
    insertSession(db, "sess-2", "proj-1", {
      title: "Add tests",
      directory: "/Users/dev/project-a",
      timeCreated: 1706100000,
    });

    // Add an assistant message to get model info
    insertMessage(db, "msg-1", "sess-1", {
      role: "assistant",
      modelID: "claude-sonnet-4-20250514",
      providerID: "anthropic",
      tokens: { input: 100, output: 50, cache: { read: 0, write: 0 } },
    });
    insertMessage(db, "msg-2", "sess-2", {
      role: "assistant",
      modelID: "gpt-4o",
      providerID: "openai",
      tokens: { input: 200, output: 100, cache: { read: 0, write: 0 } },
    });
    db.close();

    const sessions = await listOpenCodeSessions("proj-1");

    expect(sessions).toHaveLength(2);
    // Most recent first
    expect(sessions[0]?.sessionId).toBe("sess-2");
    expect(sessions[0]?.firstMessage).toBe("Add tests");
    expect(sessions[0]?.model).toBe("gpt-4o");
    expect(sessions[0]?.pluginId).toBe("opencode");

    expect(sessions[1]?.sessionId).toBe("sess-1");
    expect(sessions[1]?.firstMessage).toBe("Fix the login bug");
    expect(sessions[1]?.model).toBe("claude-sonnet-4-20250514");
  });

  test("falls back to first user text part when title is empty", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a");
    insertSession(db, "sess-1", "proj-1", {
      title: "",
      directory: "/Users/dev/project-a",
      timeCreated: 1706000000,
    });

    // Add user message with text part
    insertMessage(
      db,
      "msg-1",
      "sess-1",
      {
        role: "user",
        time: { created: 1706000000 },
      },
      1706000000,
    );
    insertPart(db, "part-1", "msg-1", "sess-1", {
      type: "text",
      text: "Help me fix the authentication flow",
    });
    db.close();

    const sessions = await listOpenCodeSessions("proj-1");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.firstMessage).toBe("Help me fix the authentication flow");
  });

  test("falls back to default message when no title or user text", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a");
    insertSession(db, "sess-1", "proj-1", {
      title: "",
      directory: "/Users/dev/project-a",
    });
    db.close();

    const sessions = await listOpenCodeSessions("proj-1");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.firstMessage).toBe("OpenCode session");
  });

  test("returns empty when DB does not exist", async () => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });

    const sessions = await listOpenCodeSessions("proj-1");
    expect(sessions).toEqual([]);
  });

  test("returns empty for non-matching project", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a");
    insertSession(db, "sess-1", "proj-1", { directory: "/Users/dev/project-a" });
    db.close();

    const sessions = await listOpenCodeSessions("nonexistent-project");
    expect(sessions).toEqual([]);
  });

  test("sessions sorted by time_created descending", async () => {
    const db = createTestDb();
    insertProject(db, "proj-1", "/Users/dev/project-a");
    insertSession(db, "sess-old", "proj-1", {
      title: "Old session",
      directory: "/Users/dev/project-a",
      timeCreated: 1700000000,
    });
    insertSession(db, "sess-new", "proj-1", {
      title: "New session",
      directory: "/Users/dev/project-a",
      timeCreated: 1706000000,
    });
    db.close();

    const sessions = await listOpenCodeSessions("proj-1");

    expect(sessions[0]?.sessionId).toBe("sess-new");
    expect(sessions[1]?.sessionId).toBe("sess-old");
  });
});
