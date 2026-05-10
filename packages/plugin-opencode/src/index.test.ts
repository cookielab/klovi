import { Database } from "bun:sqlite";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { openCodePlugin } from "./index";
import { BunSqliteLayer } from "./runtime/bun-sqlite";

const testDir = join(tmpdir(), `klovi-opencode-index-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	BunSqliteLayer,
);

function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

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
		["project-1", "/Users/dev/opencode-project", "OpenCode Project", 1_706_000_000_000, 1_706_001_000_000],
	);

	db.run(
		"INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, 'v2', ?, ?)",
		["session-1", "project-1", "session-1", "/Users/dev/opencode-project", "", 1_706_000_000_000, 1_706_001_000_000],
	);

	db.run("INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)", [
		"msg-1",
		"session-1",
		1_706_000_000_000,
		1_706_000_000_000,
		JSON.stringify({ role: "user", time: { created: 1_706_000_000_000 } }),
	]);

	db.run("INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)", [
		"part-1",
		"msg-1",
		"session-1",
		1_706_000_000_001,
		1_706_000_000_001,
		JSON.stringify({ type: "text", text: "Please help me debug" }),
	]);

	db.run("INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)", [
		"msg-2",
		"session-1",
		1_706_000_001_000,
		1_706_000_001_000,
		JSON.stringify({ role: "assistant", modelID: "gpt-5", finish: "stop" }),
	]);

	db.run("INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)", [
		"part-2",
		"msg-2",
		"session-1",
		1_706_000_001_001,
		1_706_000_001_001,
		JSON.stringify({ type: "text", text: "Sure, I can help." }),
	]);

	db.close();
}

describe("openCodePlugin", () => {
	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("exposes plugin identity and no resume command", () => {
		expect(openCodePlugin.id).toBe("opencode");
		expect(openCodePlugin.displayName).toBe("OpenCode");
		expect(openCodePlugin.getDefaultDataDir()).toBeNull();
		expect("getResumeCommand" in openCodePlugin).toBe(false);
	});

	it("discovers, lists, and loads sessions through plugin interface", async () => {
		createDbWithSingleSession();

		const projects = await runEffect(openCodePlugin.discoverProjects);
		expect(projects).toHaveLength(1);
		expect(projects[0]?.nativeId).toBe("project-1");
		expect(projects[0]?.resolvedPath).toBe("/Users/dev/opencode-project");

		const sessions = await runEffect(openCodePlugin.listSessions("project-1"));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.pluginId).toBe("opencode");
		expect(sessions[0]?.firstMessage).toBe("Please help me debug");

		const session = await runEffect(openCodePlugin.loadSession("project-1", "session-1"));
		expect(session.pluginId).toBe("opencode");
		expect(session.project).toBe("/Users/dev/opencode-project");
		expect(session.turns).toHaveLength(2);
	});

	it("returns empty discovery/list results when db is missing", async () => {
		const projects = await runEffect(openCodePlugin.discoverProjects);
		const sessions = await runEffect(openCodePlugin.listSessions("project-1"));

		expect(projects).toEqual([]);
		expect(sessions).toEqual([]);
	});
});
