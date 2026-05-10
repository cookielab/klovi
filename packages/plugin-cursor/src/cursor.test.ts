import { Database } from "bun:sqlite";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AssistantTurn, SqliteDb, UserTurn } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { encodeCursorProjectPath, getCursorGlobalDbPath, getCursorWorkspaceStorageDir } from "./config";
import { buildCursorIndex, discoverCursorProjects, listCursorSessions } from "./discovery";
import { cursorPlugin } from "./index";
import { buildTurnsFromBubbles, loadCursorSession } from "./parser";


const N_7 = 7;
const N_1000 = 1000;

const TEST_SQLITE_LAYER = Layer.succeed(SqliteClientTag, {
	open: (dbPath: string, options?: { readonly: boolean }) =>
		Effect.try({
			try: () =>
				new Database(dbPath, {
					readonly: options?.readonly ?? true,
				}) as unknown as SqliteDb,
			catch: () => null as SqliteDb | null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null as SqliteDb | null))),
});

const CREATED_AT_MS = 1_706_000_000_000;

const ORIGINAL_ENV = {
	["HOME"]: Bun.env["HOME"],
	["USERPROFILE"]: Bun.env["USERPROFILE"],
	["XDG_CONFIG_HOME"]: Bun.env["XDG_CONFIG_HOME"],
	["APPDATA"]: Bun.env["APPDATA"],
};

let testDir = "";
let userDataDir = "";

function restoreEnv(): void {
	Bun.env["HOME"] = ORIGINAL_ENV.HOME;
	Bun.env["USERPROFILE"] = ORIGINAL_ENV.USERPROFILE;
	Bun.env["XDG_CONFIG_HOME"] = ORIGINAL_ENV.XDG_CONFIG_HOME;
	Bun.env["APPDATA"] = ORIGINAL_ENV.APPDATA;
}

function makeTestLayer() {
	return Layer.mergeAll(NodeFileSystem.layer, Layer.succeed(PluginConfig, { dataDir: userDataDir }), TEST_SQLITE_LAYER);
}

function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())) as Effect.Effect<A, E, never>);
}

async function writeCursorDb(
	dbPath: string,
	options: {
		itemTable?: Record<string, string>;
		cursorDiskKv?: Record<string, string>;
	} = {},
): Promise<void> {
	await mkdir(dirname(dbPath), { recursive: true });
	const db = new Database(dbPath, { create: true });

	db.run("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
	db.run("CREATE TABLE IF NOT EXISTS cursorDiskKV (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

	for (const [key, value] of Object.entries(options.itemTable ?? {})) {
		db.run("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", [key, value]);
	}

	for (const [key, value] of Object.entries(options.cursorDiskKv ?? {})) {
		db.run("INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)", [key, value]);
	}

	db.close();
}

async function addWorkspace(
	workspaceId: string,
	projectPath: string,
	composerEntries: Record<string, unknown>[] = [],
): Promise<void> {
	const workspaceDir = join(getCursorWorkspaceStorageDir(), workspaceId);
	await mkdir(projectPath, { recursive: true });
	await mkdir(workspaceDir, { recursive: true });
	await writeFile(
		join(workspaceDir, "workspace.json"),
		JSON.stringify({ folder: pathToFileURL(projectPath).toString() }),
	);
	await writeCursorDb(join(workspaceDir, "state.vscdb"), {
		itemTable: {
			"composer.composerData": JSON.stringify({ allComposers: composerEntries }),
		},
	});
}

async function writeGlobalState(
	options: { itemTable?: Record<string, string>; cursorDiskKv?: Record<string, string> } = {},
): Promise<void> {
	await writeCursorDb(getCursorGlobalDbPath(), options);
}

async function addAgentTranscript(
	projectPath: string,
	agentId: string,
	lines: Record<string, unknown>[],
	mtimeIso = "2024-01-11T19:06:41.000Z",
): Promise<string> {
	const encodedProjectPath = encodeCursorProjectPath(projectPath);
	const transcriptPath = join(
		userDataDir,
		"projects",
		encodedProjectPath,
		"agent-transcripts",
		agentId,
		`${agentId}.jsonl`,
	);
	await mkdir(dirname(transcriptPath), { recursive: true });
	await writeFile(transcriptPath, lines.map((line) => JSON.stringify(line)).join("\n"));
	const mtime = new Date(mtimeIso);
	await utimes(transcriptPath, mtime, mtime);
	return transcriptPath;
}

async function writePlanFile(filePath: string, text: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, text);
}

describe("cursor plugin", () => {
	beforeEach(async () => {
		testDir = join(tmpdir(), `klovi-cursor-test-${Date.now()}-${crypto.randomUUID()}`);
		userDataDir = join(testDir, ".cursor");
		Bun.env["HOME"] = testDir;
		Bun.env["USERPROFILE"] = testDir;
		Bun.env["XDG_CONFIG_HOME"] = join(testDir, ".config");
		Bun.env["APPDATA"] = join(testDir, "AppData", "Roaming");
		await rm(testDir, { recursive: true, force: true });
		await mkdir(userDataDir, { recursive: true });
	});

	afterEach(async () => {
		restoreEnv();
		await rm(testDir, { recursive: true, force: true });
	});

	it("buildTurnsFromBubbles maps text, thinking, and tool blocks in order", () => {
		const turns = buildTurnsFromBubbles(
			[
				{ bubbleId: "user-1", type: 1, text: "Inspect the auth flow" },
				{ bubbleId: "assistant-1", type: 2, text: "I checked the main handler." },
				{ bubbleId: "assistant-2", type: 2, capabilityType: N_7, thinking: { text: "Need to compare routes." } },
				{
					bubbleId: "assistant-3",
					type: 2,
					toolFormerData: {
						toolCallId: "tool-1",
						name: "read_file",
						params: '{"path":"/tmp/auth.ts"}',
						result: { ok: true },
						status: "success",
					},
				},
			],
			CREATED_AT_MS,
		);

		expect(turns).toHaveLength(2);
		const userTurn = turns[0] as UserTurn;
		const assistantTurn = turns[1] as AssistantTurn;

		expect(userTurn.kind).toBe("user");
		expect(userTurn.text).toBe("Inspect the auth flow");
		expect(assistantTurn.kind).toBe("assistant");
		expect(assistantTurn.contentBlocks.map((block) => block.type)).toEqual(["text", "thinking", "tool_call"]);
		expect(assistantTurn.contentBlocks[1]?.type).toBe("thinking");
		expect(assistantTurn.contentBlocks[2]?.type).toBe("tool_call");

		const toolBlock = assistantTurn.contentBlocks[2] as Extract<
			(typeof assistantTurn.contentBlocks)[number],
			{ type: "tool_call" }
		>;
		expect(toolBlock.call.name).toBe("read_file");
		expect(toolBlock.call.rawName).toBe("read_file");
		expect(toolBlock.call.kind).toBe("file_read");
		expect(toolBlock.call.title).toBe("read_file");
		expect(toolBlock.call.toolUseId).toBe("tool-1");
		expect(toolBlock.call.input).toEqual({ path: "/tmp/auth.ts" });
		expect(toolBlock.call.result).toContain('"ok": true');
		expect(toolBlock.call.isError).toBe(false);
		expect(toolBlock.call.summary).toBe("/tmp/auth.ts");
		expect(toolBlock.call.formattedInput).toBe("File: /tmp/auth.ts");
	});

	it("discovers composer sessions from workspace Cursor state", async () => {
		const projectPath = join(testDir, "project-alpha");
		await addWorkspace("workspace-alpha", projectPath, [
			{
				composerId: "composer-1",
				name: "Auth implementation",
				createdAt: CREATED_AT_MS,
				lastUpdatedAt: CREATED_AT_MS + N_1000,
				unifiedMode: "agent",
			},
		]);
		await writeGlobalState({
			cursorDiskKv: {
				"composerData:composer-1": JSON.stringify({
					composerId: "composer-1",
					conversation: [{ bubbleId: "user-1", type: 1, text: "Implement auth flow" }],
				}),
			},
		});

		const projects = await runEffect(discoverCursorProjects());
		expect(projects).toHaveLength(1);
		expect(projects[0]?.pluginId).toBe("cursor");
		expect(projects[0]?.nativeId).toBe(projectPath);

		const sessions = await runEffect(listCursorSessions(projectPath));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("composer:composer-1");
		expect(sessions[0]?.firstMessage).toBe("Implement auth flow");
		expect(sessions[0]?.sessionType).toBe("implementation");
	});

	it("discovers background agent transcripts for known workspace paths", async () => {
		const projectPath = join(testDir, "project-beta");
		await addWorkspace("workspace-beta", projectPath);
		await addAgentTranscript(projectPath, "agent-1", [
			{
				role: "user",
				message: {
					content: [{ type: "text", text: "Prepare rollout plan" }],
				},
			},
			{
				role: "assistant",
				message: {
					content: [{ type: "text", text: "Drafting it now." }],
				},
			},
		]);

		const index = await runEffect(buildCursorIndex());
		expect(index.projects).toHaveLength(1);
		expect(index.agentsById.get("agent-1")?.projectPath).toBe(projectPath);

		const sessions = await runEffect(listCursorSessions(projectPath));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("agent:agent-1");
		expect(sessions[0]?.firstMessage).toBe("Prepare rollout plan");
		expect(sessions[0]?.sessionType).toBe("implementation");
	});

	it("lists and loads background agent sessions for an explicit project path without a workspace", async () => {
		const projectPath = join(testDir, "project-no-workspace");
		await mkdir(projectPath, { recursive: true });
		await addAgentTranscript(projectPath, "agent-standalone", [
			{
				role: "user",
				message: {
					content: [{ type: "text", text: "Investigate the release freeze" }],
				},
			},
			{
				role: "assistant",
				message: {
					content: [{ type: "text", text: "I am checking it now." }],
				},
			},
		]);

		const sessions = await runEffect(listCursorSessions(projectPath));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("agent:agent-standalone");
		expect(sessions[0]?.firstMessage).toBe("Investigate the release freeze");

		const session = await runEffect(loadCursorSession(projectPath, "agent:agent-standalone"));
		expect(session.project).toBe(projectPath);
		expect(session.turns).toHaveLength(2);
		expect((session.turns[0] as UserTurn).text).toBe("Investigate the release freeze");
	});

	it("maps plans to composer or agent sessions and excludes orphan plans", async () => {
		const projectPath = join(testDir, "project-gamma");
		const composerPlanPath = join(testDir, "plans", "composer.plan.md");
		const agentPlanPath = join(testDir, "plans", "agent.plan.md");
		const orphanPlanPath = join(testDir, "plans", "orphan.plan.md");

		await addWorkspace("workspace-gamma", projectPath, [
			{
				composerId: "composer-1",
				name: "Foreground planning",
				createdAt: CREATED_AT_MS,
				unifiedMode: "plan",
			},
		]);
		await addAgentTranscript(projectPath, "agent-1", [
			{
				role: "user",
				message: {
					content: [{ type: "text", text: "Implement the changes" }],
				},
			},
		]);
		await writePlanFile(composerPlanPath, "---\nname: Composer plan\n---\n\nPlan body");
		await writePlanFile(agentPlanPath, "# Agent plan\n\nPlan body");
		await writePlanFile(orphanPlanPath, "# Orphan plan\n\nPlan body");
		await writeGlobalState({
			itemTable: {
				"composer.planRegistry": JSON.stringify({
					"plan-1": {
						id: "plan-1",
						createdBy: "composer-1",
						createdAt: CREATED_AT_MS,
						uri: { fsPath: composerPlanPath },
					},
					"plan-2": {
						id: "plan-2",
						createdBy: "agent-1",
						createdAt: CREATED_AT_MS + 1,
						uri: { fsPath: agentPlanPath },
					},
					orphan: {
						id: "orphan",
						createdBy: "missing-agent",
						createdAt: CREATED_AT_MS + 2,
						uri: { fsPath: orphanPlanPath },
					},
				}),
			},
		});

		const index = await runEffect(buildCursorIndex());
		expect([...index.plansById.keys()].sort()).toEqual(["plan-1", "plan-2"]);
		expect(index.plansById.get("plan-1")?.firstMessage).toBe("Composer plan");
		expect(index.plansById.get("plan-2")?.firstMessage).toBe("Agent plan");
		expect(index.plansById.has("orphan")).toBe(false);
		expect(index.agentsById.get("agent-1")?.sessionType).toBe("plan");
	});

	it("reconstructs composer sessions from headers and bubble rows", async () => {
		const projectPath = join(testDir, "project-delta");
		await addWorkspace("workspace-delta", projectPath, [
			{
				composerId: "composer-1",
				name: "Composer session",
				createdAt: CREATED_AT_MS,
				unifiedMode: "agent",
			},
		]);
		await writeGlobalState({
			cursorDiskKv: {
				"composerData:composer-1": JSON.stringify({
					composerId: "composer-1",
					createdAt: CREATED_AT_MS,
					fullConversationHeadersOnly: [
						{ bubbleId: "user-1" },
						{ bubbleId: "assistant-1" },
						{ bubbleId: "assistant-2" },
						{ bubbleId: "assistant-3" },
					],
				}),
				"bubbleId:composer-1:user-1": JSON.stringify({
					bubbleId: "user-1",
					type: 1,
					text: "Audit the auth flow",
				}),
				"bubbleId:composer-1:assistant-1": JSON.stringify({
					bubbleId: "assistant-1",
					type: 2,
					text: "I inspected the current flow.",
				}),
				"bubbleId:composer-1:assistant-2": JSON.stringify({
					bubbleId: "assistant-2",
					type: 2,
					capabilityType: N_7,
					thinking: { text: "Need to compare middleware branches." },
				}),
				"bubbleId:composer-1:assistant-3": JSON.stringify({
					bubbleId: "assistant-3",
					type: 2,
					toolFormerData: {
						toolCallId: "tool-1",
						name: "read_file",
						params: '{"path":"/tmp/auth.ts"}',
						result: { checked: true },
						status: "completed",
					},
				}),
			},
		});

		const session = await runEffect(loadCursorSession(projectPath, "composer:composer-1"));
		expect(session.pluginId).toBe("cursor");
		expect(session.turns).toHaveLength(2);

		const userTurn = session.turns[0] as UserTurn;
		const assistantTurn = session.turns[1] as AssistantTurn;
		expect(userTurn.text).toBe("Audit the auth flow");
		expect(assistantTurn.contentBlocks.map((block) => block.type)).toEqual(["text", "thinking", "tool_call"]);
	});

	it("falls back to inline composer conversation when headers are absent", async () => {
		const projectPath = join(testDir, "project-inline");
		await addWorkspace("workspace-inline", projectPath, [
			{
				composerId: "composer-inline",
				name: "Inline session",
				createdAt: CREATED_AT_MS,
				unifiedMode: "chat",
			},
		]);
		await writeGlobalState({
			cursorDiskKv: {
				"composerData:composer-inline": JSON.stringify({
					composerId: "composer-inline",
					createdAt: CREATED_AT_MS,
					conversation: [
						{ bubbleId: "user-1", type: 1, text: "Summarize the refactor" },
						{ bubbleId: "assistant-1", type: 2, text: "Here is the summary." },
					],
				}),
			},
		});

		const session = await runEffect(loadCursorSession(projectPath, "composer:composer-inline"));
		expect(session.turns).toHaveLength(2);
		expect((session.turns[0] as UserTurn).text).toBe("Summarize the refactor");

		const assistantTurn = session.turns[1] as AssistantTurn;
		expect(assistantTurn.contentBlocks[0]?.type).toBe("text");
	});

	it("returns partial composer sessions when bubble rows are missing", async () => {
		const projectPath = join(testDir, "project-partial");
		await addWorkspace("workspace-partial", projectPath, [
			{
				composerId: "composer-partial",
				name: "Partial session",
				createdAt: CREATED_AT_MS,
				unifiedMode: "agent",
			},
		]);
		await writeGlobalState({
			cursorDiskKv: {
				"composerData:composer-partial": JSON.stringify({
					composerId: "composer-partial",
					createdAt: CREATED_AT_MS,
					fullConversationHeadersOnly: [{ bubbleId: "user-1" }, { bubbleId: "assistant-missing" }],
				}),
				"bubbleId:composer-partial:user-1": JSON.stringify({
					bubbleId: "user-1",
					type: 1,
					text: "Recover what you can",
				}),
			},
		});

		const session = await runEffect(loadCursorSession(projectPath, "composer:composer-partial"));
		const [notice] = session.turns;
		expect(notice?.kind).toBe("system");
		if (!notice || notice.kind !== "system") {
			throw new Error("expected partial-session notice");
		}
		expect(notice.text).toContain("Partial Cursor session");
		expect(session.turns[1]?.kind).toBe("user");
		expect((session.turns[1] as UserTurn).text).toBe("Recover what you can");
	});

	it("parses background agent transcripts into user and assistant turns", async () => {
		const projectPath = join(testDir, "project-agent");
		await addWorkspace("workspace-agent", projectPath);
		await addAgentTranscript(projectPath, "agent-2", [
			{
				role: "user",
				message: {
					content: [{ type: "text", text: "Create the migration plan" }],
				},
			},
			{
				role: "assistant",
				message: {
					content: [{ type: "text", text: "I will prepare the migration plan." }],
				},
			},
		]);

		const session = await runEffect(loadCursorSession(projectPath, "agent:agent-2"));
		expect(session.turns).toHaveLength(2);
		expect((session.turns[0] as UserTurn).text).toBe("Create the migration plan");

		const assistantTurn = session.turns[1] as AssistantTurn;
		expect(assistantTurn.contentBlocks[0]?.type).toBe("text");
	});

	it("exposes plugin identity and supports end-to-end discovery through plugin API", async () => {
		const projectPath = join(testDir, "project-plugin");
		await addWorkspace("workspace-plugin", projectPath, [
			{
				composerId: "composer-plugin",
				name: "Plugin session",
				createdAt: CREATED_AT_MS,
				unifiedMode: "agent",
			},
		]);
		await writeGlobalState({
			cursorDiskKv: {
				"composerData:composer-plugin": JSON.stringify({
					composerId: "composer-plugin",
					createdAt: CREATED_AT_MS,
					conversation: [
						{ bubbleId: "user-1", type: 1, text: "Open the session" },
						{ bubbleId: "assistant-1", type: 2, text: "Session opened." },
					],
				}),
			},
		});

		expect(cursorPlugin.id).toBe("cursor");
		expect(cursorPlugin.displayName).toBe("Cursor");
		expect(cursorPlugin.getDefaultDataDir()).toBeNull();
		expect("getResumeCommand" in cursorPlugin).toBe(false);

		expect(await runEffect(cursorPlugin.isDataAvailable)).toBe(true);

		const projects = await runEffect(cursorPlugin.discoverProjects);
		expect(projects).toHaveLength(1);

		const sessions = await runEffect(cursorPlugin.listSessions(projectPath));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.pluginId).toBe("cursor");

		const session = await runEffect(cursorPlugin.loadSession(projectPath, "composer:composer-plugin"));
		expect(session.pluginId).toBe("cursor");
		expect(session.project).toBe(projectPath);
		expect(session.turns).toHaveLength(2);
	});
});
