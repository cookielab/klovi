import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { claudeCodePlugin } from "./index.ts";

const testDir = join(tmpdir(), `klovi-claude-index-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);

function run<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

async function writeJsonl(filePath: string, lines: Record<string, unknown>[]): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await Bun.write(filePath, lines.map((line) => JSON.stringify(line)).join("\n"));
}

describe("claudeCodePlugin", () => {
	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("exposes plugin identity and resume command", () => {
		expect(claudeCodePlugin.id).toBe("claude-code");
		expect(claudeCodePlugin.displayName).toBe("Claude Code");
		expect(claudeCodePlugin.getDefaultDataDir()).toBeNull();
		expect(claudeCodePlugin.getResumeCommand?.("abc123")).toBe("claude --resume abc123");
	});

	test("discovers, lists, loads, and links plan/implementation sessions", async () => {
		const projectId = "-Users-dev-project";

		await writeJsonl(join(testDir, "projects", projectId, "plan-1.jsonl"), [
			{
				type: "user",
				uuid: "plan-user-1",
				timestamp: "2025-01-14T10:00:00.000Z",
				slug: "shared-slug",
				gitBranch: "main",
				cwd: "/Users/dev/project",
				message: { role: "user", model: "claude-sonnet", content: "Plan this migration" },
			},
		]);

		await writeJsonl(join(testDir, "projects", projectId, "impl-1.jsonl"), [
			{
				type: "user",
				uuid: "impl-user-1",
				timestamp: "2025-01-15T10:00:00.000Z",
				slug: "shared-slug",
				gitBranch: "main",
				cwd: "/Users/dev/project",
				message: {
					role: "user",
					model: "claude-sonnet",
					content: "Implement the following plan:\n\n1. Build plugin package",
				},
			},
			{
				type: "assistant",
				uuid: "impl-assistant-1",
				timestamp: "2025-01-15T10:01:00.000Z",
				message: {
					role: "assistant",
					model: "claude-sonnet",
					content: [{ type: "text", text: "Working on it." }],
				},
			},
		]);

		const projects = await run(claudeCodePlugin.discoverProjects);
		expect(projects).toHaveLength(1);
		expect(projects[0]?.nativeId).toBe(projectId);

		const sessions = await run(claudeCodePlugin.listSessions(projectId));
		expect(sessions).toHaveLength(2);

		const loaded = await run(claudeCodePlugin.loadSession(projectId, "impl-1"));
		expect(loaded.pluginId).toBe("claude-code");
		expect(loaded.project).toBe(projectId);
		expect(loaded.sessionId).toBe("impl-1");

		const loadDetail = claudeCodePlugin.loadSessionDetail;
		expect(loadDetail).toBeDefined();
		const implDetail = await run(loadDetail?.(projectId, "impl-1") ?? Effect.succeed(undefined));
		expect(implDetail?.planSessionId).toBe("plan-1");
		expect(implDetail?.implSessionId).toBeUndefined();

		const planDetail = await run(loadDetail?.(projectId, "plan-1") ?? Effect.succeed(undefined));
		expect(planDetail?.planSessionId).toBeUndefined();
		expect(planDetail?.implSessionId).toBe("impl-1");
	});

	test("loadSubAgentSession loads sub-agent transcript through plugin API", async () => {
		const projectId = "-Users-dev-project";
		await writeJsonl(join(testDir, "projects", projectId, "impl-1", "subagents", "agent-42.jsonl"), [
			{
				type: "user",
				uuid: "subagent-user-1",
				timestamp: "2025-01-15T11:00:00.000Z",
				message: { role: "user", content: "sub-agent hello" },
			},
		]);

		const loadSubAgent = claudeCodePlugin.loadSubAgentSession;
		expect(loadSubAgent).toBeDefined();
		const subSession = await run(
			loadSubAgent?.({
				sessionId: "impl-1",
				project: projectId,
				agentId: "42",
			}) ?? Effect.succeed(undefined),
		);

		expect(subSession).toBeDefined();
		expect(subSession?.pluginId).toBe("claude-code");
		expect(subSession?.turns).toHaveLength(1);
		expect(subSession?.turns[0]).toMatchObject({ kind: "user", text: "sub-agent hello" });
	});
});
