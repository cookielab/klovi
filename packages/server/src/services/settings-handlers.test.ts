import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import {
	completeOnboarding as completeOnboardingEffect,
	isFirstLaunch as isFirstLaunchEffect,
	resetSettings as resetSettingsEffect,
} from "./onboarding-service";
import { getDefaultSettings, loadSettings as loadSettingsEffect, saveSettings as saveSettingsEffect } from "./settings";
import {
	getGeneralSettings as getGeneralSettingsEffect,
	getPluginSettings as getPluginSettingsEffect,
	updateGeneralSettings as updateGeneralSettingsEffect,
	updatePluginSetting as updatePluginSettingEffect,
} from "./settings-service";

const N_4 = 4;

function runFs<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

function loadSettings(path: string): Promise<Effect.Effect.Success<ReturnType<typeof loadSettingsEffect>>> {
	return runFs(loadSettingsEffect(path));
}

function saveSettings(
	path: string,
	settings: Parameters<typeof saveSettingsEffect>[1],
): Promise<Effect.Effect.Success<ReturnType<typeof saveSettingsEffect>>> {
	return runFs(saveSettingsEffect(path, settings));
}

function getPluginSettings(path: string): Promise<Effect.Effect.Success<ReturnType<typeof getPluginSettingsEffect>>> {
	return runFs(getPluginSettingsEffect(path));
}

function updatePluginSetting(
	path: string,
	params: Parameters<typeof updatePluginSettingEffect>[1],
): Promise<Effect.Effect.Success<ReturnType<typeof updatePluginSettingEffect>>> {
	return runFs(updatePluginSettingEffect(path, params));
}

function getGeneralSettings(path: string): Promise<Effect.Effect.Success<ReturnType<typeof getGeneralSettingsEffect>>> {
	return runFs(getGeneralSettingsEffect(path));
}

function updateGeneralSettings(
	path: string,
	params: Parameters<typeof updateGeneralSettingsEffect>[1],
): Promise<Effect.Effect.Success<ReturnType<typeof updateGeneralSettingsEffect>>> {
	return runFs(updateGeneralSettingsEffect(path, params));
}

function isFirstLaunch(path: string): Promise<Effect.Effect.Success<ReturnType<typeof isFirstLaunchEffect>>> {
	return runFs(isFirstLaunchEffect(path));
}

function resetSettings(path: string): Promise<Effect.Effect.Success<ReturnType<typeof resetSettingsEffect>>> {
	return runFs(resetSettingsEffect(path));
}

function completeOnboarding(path: string): Promise<Effect.Effect.Success<ReturnType<typeof completeOnboardingEffect>>> {
	return runFs(completeOnboardingEffect(path));
}

const testDir = join(tmpdir(), `klovi-handlers-test-${Date.now()}`);
const settingsPath = join(testDir, "settings.json");

describe("settings RPC handlers", () => {
	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("getPluginSettings returns all four plugins", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await getPluginSettings(settingsPath);
		expect(result.plugins).toHaveLength(N_4);
		expect(result.plugins.map((p) => p.id)).toEqual(["claude-code", "codex-cli", "opencode", "cursor"]);
	});

	it("getPluginSettings shows enabled and default dirs", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await getPluginSettings(settingsPath);
		const claude = result.plugins.find((p) => p.id === "claude-code");
		expect(claude).toBeDefined();
		expect(claude?.enabled).toBe(true);
		expect(claude?.isCustomDir).toBe(false);
		expect(claude?.dataDir).toBe(claude?.defaultDataDir);
	});

	it("getPluginSettings uses Cursor's default disabled state for legacy settings files", async () => {
		await mkdir(testDir, { recursive: true });
		const defaults = getDefaultSettings();
		const { cursor: _cursor, ...legacyPlugins } = defaults.plugins;
		const settings = { ...defaults, plugins: legacyPlugins };
		await saveSettings(settingsPath, settings);

		const result = await getPluginSettings(settingsPath);
		const cursor = result.plugins.find((p) => p.id === "cursor");
		expect(cursor).toBeDefined();
		expect(cursor?.enabled).toBe(false);
		expect(cursor?.isCustomDir).toBe(false);
		expect(cursor?.dataDir).toBe(cursor?.defaultDataDir);
	});

	it("updatePluginSetting disables a plugin", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await updatePluginSetting(settingsPath, {
			pluginId: "claude-code",
			enabled: false,
		});
		const claude = result.plugins.find((p) => p.id === "claude-code");
		expect(claude).toBeDefined();
		expect(claude?.enabled).toBe(false);

		// Verify persisted
		const loaded = await loadSettings(settingsPath);
		expect(loaded.plugins["claude-code"]?.enabled).toBe(false);
	});

	it("updatePluginSetting sets custom dataDir", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await updatePluginSetting(settingsPath, {
			pluginId: "claude-code",
			dataDir: "/custom/path",
		});
		const claude = result.plugins.find((p) => p.id === "claude-code");
		expect(claude).toBeDefined();
		expect(claude?.dataDir).toBe("/custom/path");
		expect(claude?.isCustomDir).toBe(true);
	});

	it("getGeneralSettings returns true by default", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await getGeneralSettings(settingsPath);
		expect(result.showSecurityWarning).toBe(true);
	});

	it("getGeneralSettings returns true for legacy settings without general", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		settings.general = undefined;
		await saveSettings(settingsPath, settings);
		const result = await getGeneralSettings(settingsPath);
		expect(result.showSecurityWarning).toBe(true);
	});

	it("updateGeneralSettings sets showSecurityWarning to false", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await updateGeneralSettings(settingsPath, { showSecurityWarning: false });
		expect(result.showSecurityWarning).toBe(false);

		// Verify persisted
		const loaded = await loadSettings(settingsPath);
		expect(loaded.general?.showSecurityWarning).toBe(false);
	});

	it("updateGeneralSettings sets showSecurityWarning to true", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		settings.general = { showSecurityWarning: false };
		await saveSettings(settingsPath, settings);
		const result = await updateGeneralSettings(settingsPath, { showSecurityWarning: true });
		expect(result.showSecurityWarning).toBe(true);
	});

	it("updatePluginSetting resets dataDir to default with null", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		const claudePlugin = settings.plugins["claude-code"];
		expect(claudePlugin).toBeDefined();
		if (claudePlugin) {
			claudePlugin.dataDir = "/custom/path";
		}
		await saveSettings(settingsPath, settings);

		const result = await updatePluginSetting(settingsPath, {
			pluginId: "claude-code",
			dataDir: null,
		});
		const claude = result.plugins.find((p) => p.id === "claude-code");
		expect(claude).toBeDefined();
		expect(claude?.isCustomDir).toBe(false);
	});

	it("isFirstLaunch returns true when settings file does not exist", async () => {
		// testDir cleaned by afterEach — no settings file present
		const result = await isFirstLaunch(settingsPath);
		expect(result.firstLaunch).toBe(true);
	});

	it("isFirstLaunch returns false when settings file exists", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await isFirstLaunch(settingsPath);
		expect(result.firstLaunch).toBe(false);
	});

	it("resetSettings deletes settings file when it exists", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());
		const result = await resetSettings(settingsPath);
		expect(result.ok).toBe(true);
		expect((await isFirstLaunch(settingsPath)).firstLaunch).toBe(true);
	});

	it("resetSettings is idempotent when file does not exist", async () => {
		const result = await resetSettings(settingsPath);
		expect(result.ok).toBe(true);
	});

	it("completeOnboarding creates settings.json when missing", async () => {
		const result = await completeOnboarding(settingsPath);
		expect(result.ok).toBe(true);
		expect((await isFirstLaunch(settingsPath)).firstLaunch).toBe(false);
		const loaded = await loadSettings(settingsPath);
		expect(loaded.version).toBe(1);
		expect(loaded.plugins["claude-code"]?.enabled).toBe(true);
		expect(loaded.plugins["cursor"]?.enabled).toBe(false);
	});

	it("completeOnboarding does not overwrite existing settings", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		settings.plugins["claude-code"] = { enabled: false, dataDir: "/custom" };
		await saveSettings(settingsPath, settings);

		await completeOnboarding(settingsPath);

		const loaded = await loadSettings(settingsPath);
		expect(loaded.plugins["claude-code"]?.enabled).toBe(false);
		expect(loaded.plugins["claude-code"]?.dataDir).toBe("/custom");
	});
});
