import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import type { PluginSettings } from "./settings.ts";
import { getDefaultSettings, loadSettings, saveSettings } from "./settings.ts";

const testDir = join(tmpdir(), `klovi-settings-test-${Date.now()}`);

function settingsPath(): string {
	return join(testDir, "settings.json");
}

function run<A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

describe("settings", () => {
	afterEach(async () => {
		if (await Bun.file(testDir).exists()) {
			await rm(testDir, { recursive: true });
		}
	});

	test("getDefaultSettings returns the built-in plugin defaults with null dataDirs", () => {
		const settings = getDefaultSettings();
		expect(settings.version).toBe(1);
		expect(settings.plugins["claude-code"]).toEqual({ enabled: true, dataDir: null });
		expect(settings.plugins["codex-cli"]).toEqual({ enabled: true, dataDir: null });
		expect(settings.plugins["opencode"]).toEqual({ enabled: true, dataDir: null });
		expect(settings.plugins["cursor"]).toEqual({ enabled: false, dataDir: null });
	});

	test("loadSettings returns defaults when file does not exist", async () => {
		const settings = await run(loadSettings(join(testDir, "nonexistent", "settings.json")));
		expect(settings).toEqual(getDefaultSettings());
	});

	test("saveSettings writes and loadSettings reads back", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		const settings: PluginSettings = {
			version: 1,
			plugins: {
				"claude-code": { enabled: false, dataDir: "/custom/path" },
				"codex-cli": { enabled: true, dataDir: null },
				opencode: { enabled: true, dataDir: null },
				cursor: { enabled: false, dataDir: null },
			},
		};
		await run(saveSettings(path, settings));
		const loaded = await run(loadSettings(path));
		expect(loaded).toEqual(settings);
	});

	test("saveSettings creates parent directories", async () => {
		const deep = join(testDir, "a", "b", "settings.json");
		await run(saveSettings(deep, getDefaultSettings()));
		expect(await Bun.file(deep).exists()).toBe(true);
	});

	test("loadSettings returns defaults for corrupted JSON", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		await Bun.write(path, "not valid json{{{");
		const settings = await run(loadSettings(path));
		expect(settings).toEqual(getDefaultSettings());
	});

	test("getDefaultSettings includes updates with stable channel", () => {
		const settings = getDefaultSettings();
		expect(settings.updates).toEqual({
			channel: "stable",
			checkIntervalHours: 6,
			autoDownload: true,
		});
	});

	test("loadSettings preserves updates field", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		const settings: PluginSettings = {
			...getDefaultSettings(),
			updates: { channel: "beta", checkIntervalHours: 1, autoDownload: false },
		};
		await run(saveSettings(path, settings));
		const loaded = await run(loadSettings(path));
		expect(loaded.updates).toEqual({ channel: "beta", checkIntervalHours: 1, autoDownload: false });
	});
});
