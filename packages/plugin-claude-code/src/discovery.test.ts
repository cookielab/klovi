import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { classifySessionTypes, discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";

const testDir = join(tmpdir(), `klovi-claude-discovery-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);

function run<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

async function writeSession(projectId: string, sessionId: string, lines: string[]): Promise<string> {
	const projectDir = join(testDir, "projects", projectId);
	await mkdir(projectDir, { recursive: true });
	const filePath = join(projectDir, `${sessionId}.jsonl`);
	await Bun.write(filePath, lines.join("\n"));
	return filePath;
}

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("claude-code discovery", () => {
	test("discoverClaudeProjects returns empty when projects dir is missing", async () => {
		const projects = await run(discoverClaudeProjects());
		expect(projects).toEqual([]);
	});

	test("listClaudeSessions returns empty when project dir is missing", async () => {
		const sessions = await run(listClaudeSessions("missing-project"));
		expect(sessions).toEqual([]);
	});

	test("discovers projects and lists sessions from valid jsonl files", async () => {
		await writeSession("-Users-dev-project-a", "session-1", [
			JSON.stringify({
				type: "user",
				timestamp: "2025-01-15T10:00:00.000Z",
				slug: "feature-a",
				gitBranch: "main",
				cwd: "/Users/dev/project-a",
				isMeta: false,
				message: {
					model: "claude-sonnet-4-5-20250929",
					content: "Fix login flow",
				},
			}),
		]);

		const projects = await run(discoverClaudeProjects());
		expect(projects).toHaveLength(1);
		expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");
		expect(projects[0]?.sessionCount).toBe(1);

		const sessions = await run(listClaudeSessions("-Users-dev-project-a"));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.sessionId).toBe("session-1");
		expect(sessions[0]?.pluginId).toBe("claude-code");
		expect(sessions[0]?.firstMessage).toBe("Fix login flow");
	});

	test("prefers cwd from newest session file", async () => {
		const oldPath = await writeSession("-Users-dev-project-a", "session-1", [
			JSON.stringify({
				type: "user",
				timestamp: "2025-01-14T10:00:00.000Z",
				slug: "feature-a",
				gitBranch: "main",
				cwd: "/Users/dev/project-old",
				isMeta: false,
				message: { model: "claude-sonnet-4-5-20250929", content: "Old file" },
			}),
		]);

		const newPath = await writeSession("-Users-dev-project-a", "session-2", [
			JSON.stringify({
				type: "user",
				timestamp: "2025-01-15T10:00:00.000Z",
				slug: "feature-a",
				gitBranch: "main",
				cwd: "/Users/dev/project-new",
				isMeta: false,
				message: { model: "claude-sonnet-4-5-20250929", content: "New file" },
			}),
		]);

		await utimes(oldPath, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
		await utimes(newPath, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

		const projects = await run(discoverClaudeProjects());
		expect(projects).toHaveLength(1);
		expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-new");
		expect(projects[0]?.lastActivity).toBe("2025-01-15T00:00:00.000Z");
	});

	test("falls back to older cwd when newest session has no cwd", async () => {
		const oldPath = await writeSession("-Users-dev-project-a", "session-1", [
			JSON.stringify({
				type: "user",
				timestamp: "2025-01-14T10:00:00.000Z",
				slug: "feature-a",
				gitBranch: "main",
				cwd: "/Users/dev/project-a",
				isMeta: false,
				message: { model: "claude-sonnet-4-5-20250929", content: "Old file" },
			}),
		]);

		const newPath = await writeSession("-Users-dev-project-a", "session-2", [
			JSON.stringify({
				type: "user",
				timestamp: "2025-01-15T10:00:00.000Z",
				slug: "feature-a",
				gitBranch: "main",
				isMeta: false,
				message: { model: "claude-sonnet-4-5-20250929", content: "New file" },
			}),
		]);

		await utimes(oldPath, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
		await utimes(newPath, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

		const projects = await run(discoverClaudeProjects());
		expect(projects).toHaveLength(1);
		expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");
		expect(projects[0]?.lastActivity).toBe("2025-01-15T00:00:00.000Z");
	});

	test("listClaudeSessions returns sessions in newest-first order regardless of FS order", async () => {
		const projectId = "-Users-dev-many";
		// Create 30 sessions with reverse-sorted timestamps in line 1 to validate sort order.
		for (let i = 0; i < 30; i++) {
			const ts = `2025-01-${(15 - (i % 14)).toString().padStart(2, "0")}T10:${i.toString().padStart(2, "0")}:00.000Z`;
			await writeSession(projectId, `session-${i.toString().padStart(2, "0")}`, [
				JSON.stringify({
					type: "user",
					timestamp: ts,
					slug: `slug-${i}`,
					gitBranch: "main",
					cwd: "/Users/dev/many",
					isMeta: false,
					message: { model: "claude-sonnet-4-5-20250929", content: `msg ${i}` },
				}),
			]);
		}

		const sessions = await run(listClaudeSessions(projectId));
		const timestamps = sessions.map((s) => s.timestamp);
		const sortedDesc = [...timestamps].sort().reverse();
		expect(timestamps).toEqual(sortedDesc);
	});
});

function session(overrides: Partial<SessionSummary> & { sessionId: string }): SessionSummary {
	return {
		timestamp: "2025-01-15T10:00:00Z",
		slug: "test-slug",
		firstMessage: "Hello world",
		model: "claude-sonnet-4-5-20250929",
		gitBranch: "main",
		...overrides,
	};
}

describe("classifySessionTypes", () => {
	test("marks implementation sessions by prefix", () => {
		const sessions = [session({ sessionId: "s1", firstMessage: "Implement the following plan:\n\n# My plan" })];
		classifySessionTypes(sessions);
		expect(sessions[0]?.sessionType).toBe("implementation");
	});

	test("marks plan sessions by slug match with implementation session", () => {
		const sessions = [
			session({ sessionId: "s1", slug: "my-feature", firstMessage: "Add a logout button" }),
			session({
				sessionId: "s2",
				slug: "my-feature",
				firstMessage: "Implement the following plan:\n\n# Plan",
			}),
		];
		classifySessionTypes(sessions);
		expect(sessions[0]?.sessionType).toBe("plan");
		expect(sessions[1]?.sessionType).toBe("implementation");
	});

	test("normal sessions have no sessionType", () => {
		const sessions = [
			session({ sessionId: "s1", slug: "feature-a", firstMessage: "Fix the login bug" }),
			session({ sessionId: "s2", slug: "feature-b", firstMessage: "Add dark mode" }),
		];
		classifySessionTypes(sessions);
		expect(sessions[0]?.sessionType).toBeUndefined();
		expect(sessions[1]?.sessionType).toBeUndefined();
	});

	test("does not mark plan for different slugs", () => {
		const sessions = [
			session({ sessionId: "s1", slug: "feature-a", firstMessage: "Add a button" }),
			session({
				sessionId: "s2",
				slug: "feature-b",
				firstMessage: "Implement the following plan:\n\n# Plan",
			}),
		];
		classifySessionTypes(sessions);
		expect(sessions[0]?.sessionType).toBeUndefined();
		expect(sessions[1]?.sessionType).toBe("implementation");
	});

	test("handles multiple plan+impl pairs", () => {
		const sessions = [
			session({ sessionId: "s1", slug: "feat-1", firstMessage: "Plan feat 1" }),
			session({
				sessionId: "s2",
				slug: "feat-1",
				firstMessage: "Implement the following plan:\n\nfeat 1",
			}),
			session({ sessionId: "s3", slug: "feat-2", firstMessage: "Plan feat 2" }),
			session({
				sessionId: "s4",
				slug: "feat-2",
				firstMessage: "Implement the following plan:\n\nfeat 2",
			}),
			session({ sessionId: "s5", slug: "feat-3", firstMessage: "Normal session" }),
		];
		classifySessionTypes(sessions);
		expect(sessions[0]?.sessionType).toBe("plan");
		expect(sessions[1]?.sessionType).toBe("implementation");
		expect(sessions[2]?.sessionType).toBe("plan");
		expect(sessions[3]?.sessionType).toBe("implementation");
		expect(sessions[4]?.sessionType).toBeUndefined();
	});
});
