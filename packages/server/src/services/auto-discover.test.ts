import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getClaudeCodeDir, setClaudeCodeDir } from "@cookielab.io/klovi-plugin-claude-code";
import { getCodexCliDir, setCodexCliDir } from "@cookielab.io/klovi-plugin-codex";
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { getOpenCodeDir, setOpenCodeDir } from "@cookielab.io/klovi-plugin-opencode";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createRegistry } from "./auto-discover.ts";
import type { PluginSettings } from "./settings.ts";
import { getDefaultSettings } from "./settings.ts";

const testLayer = Layer.merge(
	NodeFileSystem.layer,
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);
const runEffect = <A>(effect: Effect.Effect<A, never, RegistryRequirements>) =>
	Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

const testDir = join(tmpdir(), `klovi-registry-test-${Date.now()}`);

describe("createRegistry with settings", () => {
	let origClaude: string;
	let origCodex: string;
	let origOpenCode: string;

	beforeEach(async () => {
		origClaude = getClaudeCodeDir();
		origCodex = getCodexCliDir();
		origOpenCode = getOpenCodeDir();
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		setClaudeCodeDir(origClaude);
		setCodexCliDir(origCodex);
		setOpenCodeDir(origOpenCode);
		await rm(testDir, { recursive: true, force: true });
	});

	test("disabled plugin is not registered even if dir exists", async () => {
		const claudeDir = join(testDir, ".claude");
		await mkdir(join(claudeDir, "projects"), { recursive: true });
		setClaudeCodeDir(claudeDir);

		const settings: PluginSettings = {
			...getDefaultSettings(),
			plugins: {
				...getDefaultSettings().plugins,
				"claude-code": { enabled: false, dataDir: null },
			},
		};

		const registry = await runEffect(createRegistry(settings));
		expect(registry.getAllPlugins().find((p) => p.id === "claude-code")).toBeUndefined();
	});

	test("custom dataDir is used for discovery", async () => {
		const customDir = join(testDir, "custom-claude");
		await mkdir(join(customDir, "projects"), { recursive: true });

		const settings: PluginSettings = {
			...getDefaultSettings(),
			plugins: {
				...getDefaultSettings().plugins,
				"claude-code": { enabled: true, dataDir: customDir },
			},
		};

		const registry = await runEffect(createRegistry(settings));
		const plugin = registry.getAllPlugins().find((p) => p.id === "claude-code");
		expect(plugin).toBeDefined();
	});

	test("without settings argument, behaves as before (all enabled, default dirs)", async () => {
		const registry = await runEffect(createRegistry());
		expect(registry).toBeDefined();
	});
});
