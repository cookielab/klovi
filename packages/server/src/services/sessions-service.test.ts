import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCodePlugin } from "@cookielab.io/klovi-plugin-claude-code";
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { PluginRegistry } from "./registry";
import { getSessionHead, getSessionTail } from "./sessions-service";

const testDir = join(tmpdir(), `klovi-sessions-service-test-${Date.now()}`);

const testLayer = Layer.merge(
	NodeFileSystem.layer,
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);

const run = <A>(effect: Effect.Effect<A, unknown, RegistryRequirements>) =>
	Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, unknown, never>);

async function writeSession(projectId: string, sessionId: string, turnCount: number): Promise<void> {
	const projectDir = join(testDir, "projects", projectId);
	await mkdir(projectDir, { recursive: true });
	const lines: string[] = [];
	for (let i = 0; i < turnCount; i++) {
		lines.push(
			JSON.stringify({
				type: "user",
				uuid: `u-${i}`,
				timestamp: `2025-01-15T10:${i.toString().padStart(2, "0")}:00Z`,
				message: { role: "user", content: `msg ${i}` },
			}),
		);
	}
	await Bun.write(join(projectDir, `${sessionId}.jsonl`), lines.join("\n"));
}

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("getSessionHead / getSessionTail", () => {
	it("head returns first headSize turns and totalTurns", async () => {
		await writeSession("-Users-x", "s1", 30);
		const registry = new PluginRegistry();
		registry.register(claudeCodePlugin, { dataDir: testDir });

		const result = await run(
			getSessionHead(registry, {
				sessionId: "claude-code::s1",
				project: "-Users-x",
				headSize: 10,
			}),
		);
		expect(result.totalTurns).toBe(30);
		expect(result.session.turns.length).toBe(10);
	});

	it("tail returns turns after fromTurn", async () => {
		await writeSession("-Users-x", "s1", 30);
		const registry = new PluginRegistry();
		registry.register(claudeCodePlugin, { dataDir: testDir });

		const result = await run(
			getSessionTail(registry, {
				sessionId: "claude-code::s1",
				project: "-Users-x",
				fromTurn: 10,
			}),
		);
		expect(result.turns.length).toBe(20);
	});

	it("tail returns empty array when fromTurn >= totalTurns", async () => {
		await writeSession("-Users-x", "s1", 5);
		const registry = new PluginRegistry();
		registry.register(claudeCodePlugin, { dataDir: testDir });

		const result = await run(
			getSessionTail(registry, {
				sessionId: "claude-code::s1",
				project: "-Users-x",
				fromTurn: 100,
			}),
		);
		expect(result.turns).toEqual([]);
	});
});
