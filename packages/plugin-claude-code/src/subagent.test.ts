import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { parseSubAgentSession } from "./parser";

const testDir = join(tmpdir(), `klovi-claude-subagent-test-${Date.now()}`);

const testLayer = Layer.mergeAll(NodeFileSystem.layer, Layer.succeed(PluginConfig, { dataDir: testDir }));

function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

describe("parseSubAgentSession", () => {
	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("returns claude pluginId when sub-agent transcript is missing", async () => {
		const session = await run(parseSubAgentSession("session-1", "-Users-dev-project", "42"));

		expect(session).toEqual({
			sessionId: "session-1",
			project: "-Users-dev-project",
			turns: [],
			pluginId: "claude-code",
		});
	});

	it("returns claude pluginId when sub-agent transcript exists", async () => {
		const filePath = join(testDir, "projects", "-Users-dev-project", "session-1", "subagents", "agent-42.jsonl");
		await mkdir(dirname(filePath), { recursive: true });
		await Bun.write(
			filePath,
			JSON.stringify({
				type: "user",
				uuid: "user-1",
				timestamp: "2025-01-15T10:00:00.000Z",
				message: {
					role: "user",
					content: "hello sub-agent",
				},
			}),
		);

		const session = await run(parseSubAgentSession("session-1", "-Users-dev-project", "42"));

		expect(session.pluginId).toBe("claude-code");
		expect(session.turns).toHaveLength(1);
		expect(session.turns[0]).toMatchObject({
			kind: "user",
			text: "hello sub-agent",
		});
	});
});
