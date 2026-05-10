/**
 * Node runtime smoke test for the plugin layer.
 *
 * Proves that all plugin packages can be imported and exercised under Node
 * with @effect/platform-node providers. Run via:
 *
 *   tsx scripts/plugin-runtime-node-smoke.ts
 *
 * Exits 0 on success, 1 on any failure.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Effect, ManagedRuntime } from "effect";
import { claudeCodePlugin } from "../packages/plugin-claude-code/src/index";
import { codexCliPlugin } from "../packages/plugin-codex/src/index";
import {
	makePluginConfigLayer,
	type PluginConfigShape,
	PluginRegistry,
	type Session,
	type SessionSummary,
} from "../packages/plugin-core/src/index";
import { cursorPlugin } from "../packages/plugin-cursor/src/index";
import { openCodePlugin } from "../packages/plugin-opencode/src/index";
import { NodePluginLayer } from "../packages/server/src/effect/platform-node";

const runtime = ManagedRuntime.make(NodePluginLayer);

function runPlugin<A, E>(effect: Effect.Effect<A, E, never>, config: PluginConfigShape): Promise<A> {
	return runtime.runPromise(effect.pipe(Effect.provide(makePluginConfigLayer(config))));
}

function runRegistry<A>(effect: Effect.Effect<A, never, never>): Promise<A> {
	return runtime.runPromise(effect);
}

let _passed = 0;
let failed = 0;

function ok(_label: string): void {
	_passed += 1;
}

function fail(_label: string, _err: unknown): void {
	failed += 1;
}

// ── Helpers ────────────────────────────────────────────────

const testDir = join(tmpdir(), `klovi-node-smoke-${Date.now()}`);

async function writeJsonl(filePath: string, lines: Record<string, unknown>[]): Promise<void> {
	const dir = filePath.substring(0, filePath.lastIndexOf("/"));
	await mkdir(dir, { recursive: true });
	await writeFile(filePath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf-8");
}

function withCursorTestEnv(): () => void {
	const originalHome = process.env["HOME"];
	const originalUserProfile = process.env["USERPROFILE"];
	const originalXdgConfigHome = process.env["XDG_CONFIG_HOME"];
	const originalAppData = process.env["APPDATA"];

	process.env["HOME"] = testDir;
	process.env["USERPROFILE"] = testDir;
	process.env["XDG_CONFIG_HOME"] = join(testDir, ".config");
	process.env["APPDATA"] = join(testDir, "AppData", "Roaming");

	return () => {
		if (originalHome === undefined) {
			process.env["HOME"] = undefined;
		} else {
			process.env["HOME"] = originalHome;
		}

		if (originalUserProfile === undefined) {
			process.env["USERPROFILE"] = undefined;
		} else {
			process.env["USERPROFILE"] = originalUserProfile;
		}

		if (originalXdgConfigHome === undefined) {
			process.env["XDG_CONFIG_HOME"] = undefined;
		} else {
			process.env["XDG_CONFIG_HOME"] = originalXdgConfigHome;
		}

		if (originalAppData === undefined) {
			process.env["APPDATA"] = undefined;
		} else {
			process.env["APPDATA"] = originalAppData;
		}
	};
}

// ── Tests ──────────────────────────────────────────────────

async function testPluginImports() {
	try {
		if (claudeCodePlugin.id !== "claude-code") {
			throw new Error("bad id");
		}
		ok("claude-code plugin imported");
	} catch (e) {
		fail("claude-code import", e);
	}
	try {
		if (codexCliPlugin.id !== "codex-cli") {
			throw new Error("bad id");
		}
		ok("codex-cli plugin imported");
	} catch (e) {
		fail("codex-cli import", e);
	}
	try {
		if (openCodePlugin.id !== "opencode") {
			throw new Error("bad id");
		}
		ok("opencode plugin imported");
	} catch (e) {
		fail("opencode import", e);
	}
	try {
		if (cursorPlugin.id !== "cursor") {
			throw new Error("bad id");
		}
		ok("cursor plugin imported");
	} catch (e) {
		fail("cursor import", e);
	}
}

async function testRegistryBuild() {
	const restoreEnv = withCursorTestEnv();
	try {
		const config = { dataDir: testDir };
		const registry = new PluginRegistry<string, SessionSummary, Session>();
		registry.register(claudeCodePlugin, config);
		registry.register(codexCliPlugin, config);
		registry.register(openCodePlugin, config);
		registry.register(cursorPlugin, config);
		ok("registry constructed with four plugins");

		const projects = await runRegistry(registry.discoverAllProjects());
		if (!Array.isArray(projects)) {
			throw new Error("expected array");
		}
		ok(`discoverAllProjects returned ${projects.length} projects`);
	} catch (e) {
		fail("registry build", e);
	} finally {
		restoreEnv();
	}
}

async function testClaudeCodeRoundTrip() {
	const config = { dataDir: testDir };
	const projectId = "-Users-dev-project";

	try {
		await writeJsonl(join(testDir, "projects", projectId, "smoke-session.jsonl"), [
			{
				type: "user",
				uuid: "u1",
				timestamp: "2025-01-14T10:00:00.000Z",
				slug: "test-slug",
				gitBranch: "main",
				cwd: "/Users/dev/project",
				message: {
					role: "user",
					model: "claude-sonnet",
					content: "Hello from Node smoke test",
				},
			},
			{
				type: "assistant",
				uuid: "a1",
				timestamp: "2025-01-14T10:01:00.000Z",
				message: {
					role: "assistant",
					model: "claude-sonnet",
					content: [{ type: "text", text: "Response from smoke test" }],
				},
			},
		]);

		const projects = await runPlugin(claudeCodePlugin.discoverProjects, config);
		if (projects.length === 0) {
			throw new Error("no projects discovered");
		}
		ok(`discovered ${projects.length} project(s)`);

		const sessions = await runPlugin(claudeCodePlugin.listSessions(projectId), config);
		if (sessions.length === 0) {
			throw new Error("no sessions found");
		}
		ok(`listed ${sessions.length} session(s)`);

		const session = await runPlugin(claudeCodePlugin.loadSession(projectId, "smoke-session"), config);
		if (session.turns.length === 0) {
			throw new Error("no turns loaded");
		}
		ok(`loaded session with ${session.turns.length} turn(s)`);
	} catch (e) {
		fail("claude-code round-trip", e);
	}
}

async function testOpenCodeImport() {
	const config = { dataDir: join(testDir, "nonexistent-opencode") };
	try {
		const available = await runPlugin(openCodePlugin.isDataAvailable, config);
		if (available !== false) {
			throw new Error(`expected false, got ${available}`);
		}
		ok("isDataAvailable returns false for missing dir");
	} catch (e) {
		fail("opencode isDataAvailable", e);
	}
}

// ── Main ───────────────────────────────────────────────────

async function main() {
	await mkdir(testDir, { recursive: true });

	try {
		await testPluginImports();
		await testRegistryBuild();
		await testClaudeCodeRoundTrip();
		await testOpenCodeImport();
	} finally {
		await rm(testDir, { recursive: true, force: true });
	}
	if (failed > 0) {
		process.exit(1);
	}
}

main().catch((_err) => {
	process.exit(1);
});
