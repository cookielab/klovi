import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { codexCliPlugin, getCodexCliDir, setCodexCliDir } from "./index.ts";

const testDir = join(tmpdir(), `klovi-codex-index-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);

function run<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

async function writeSession(
	uuid: string,
	meta: Record<string, unknown>,
	events: Record<string, unknown>[] = [],
): Promise<void> {
	const dir = join(testDir, "sessions", "openai", "2025-01-15");
	await mkdir(dir, { recursive: true });
	const filePath = join(dir, `${uuid}.jsonl`);
	const lines = [JSON.stringify(meta), ...events.map((event) => JSON.stringify(event))];
	await Bun.write(filePath, lines.join("\n"));
}

describe("codexCliPlugin", () => {
	let originalDir: string;

	beforeEach(async () => {
		originalDir = getCodexCliDir();
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
		setCodexCliDir(testDir);
	});

	afterEach(async () => {
		setCodexCliDir(originalDir);
		await rm(testDir, { recursive: true, force: true });
	});

	test("exposes plugin identity and resume command", () => {
		expect(codexCliPlugin.id).toBe("codex-cli");
		expect(codexCliPlugin.displayName).toBe("Codex");
		expect(codexCliPlugin.getDefaultDataDir()).toBeNull();
		expect(codexCliPlugin.getResumeCommand?.("session-123")).toBe("codex resume session-123");
	});

	test("discovers, lists, and loads sessions through plugin interface", async () => {
		await writeSession(
			"uuid-1",
			{
				uuid: "uuid-1",
				name: "Refactor plugin layer",
				cwd: "/Users/dev/project-a",
				timestamps: { created: 1_706_000_000, updated: 1_706_001_000 },
				model: "o4-mini",
				provider_id: "openai",
			},
			[
				{ type: "turn.started" },
				{
					type: "item.completed",
					item: { type: "agent_message", text: "I will refactor this safely." },
				},
				{ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 40 } },
			],
		);

		const projects = await run(codexCliPlugin.discoverProjects);
		expect(projects).toHaveLength(1);
		expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");

		const sessions = await run(codexCliPlugin.listSessions("/Users/dev/project-a"));
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.pluginId).toBe("codex-cli");
		expect(sessions[0]?.sessionId).toBe("uuid-1");

		const session = await run(codexCliPlugin.loadSession("/Users/dev/project-a", "uuid-1"));
		expect(session.pluginId).toBe("codex-cli");
		expect(session.project).toBe("/Users/dev/project-a");
		expect(session.sessionId).toBe("uuid-1");
		expect(session.turns).toHaveLength(1);
	});

	test("returns empty lists for unknown projects", async () => {
		const sessions = await run(codexCliPlugin.listSessions("/Users/dev/missing"));
		expect(sessions).toEqual([]);
	});
});
