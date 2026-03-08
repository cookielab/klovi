import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  completeOnboarding,
  getGeneralSettings,
  getPluginSettings,
  isFirstLaunch,
  resetSettings,
  updateGeneralSettings,
  updatePluginSetting,
} from "./app-services.ts";
import { getDefaultSettings, loadSettings, saveSettings } from "./settings.ts";

const testDir = join(tmpdir(), `klovi-handlers-test-${Date.now()}`);
const settingsPath = join(testDir, "settings.json");

describe("settings RPC handlers", () => {
  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("getPluginSettings returns all three plugins", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await getPluginSettings(settingsPath);
    expect(result.plugins).toHaveLength(3);
    expect(result.plugins.map((p) => p.id)).toEqual(["claude-code", "codex-cli", "opencode"]);
  });

  test("getPluginSettings shows enabled and default dirs", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await getPluginSettings(settingsPath);
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.enabled).toBe(true);
    expect(claude?.isCustomDir).toBe(false);
    expect(claude?.dataDir).toBe(claude?.defaultDataDir);
  });

  test("updatePluginSetting disables a plugin", async () => {
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

  test("updatePluginSetting sets custom dataDir", async () => {
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

  test("getGeneralSettings returns true by default", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await getGeneralSettings(settingsPath);
    expect(result.showSecurityWarning).toBe(true);
  });

  test("getGeneralSettings returns true for legacy settings without general", async () => {
    await mkdir(testDir, { recursive: true });
    const settings = getDefaultSettings();
    settings.general = undefined;
    await saveSettings(settingsPath, settings);
    const result = await getGeneralSettings(settingsPath);
    expect(result.showSecurityWarning).toBe(true);
  });

  test("updateGeneralSettings sets showSecurityWarning to false", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await updateGeneralSettings(settingsPath, { showSecurityWarning: false });
    expect(result.showSecurityWarning).toBe(false);

    // Verify persisted
    const loaded = await loadSettings(settingsPath);
    expect(loaded.general?.showSecurityWarning).toBe(false);
  });

  test("updateGeneralSettings sets showSecurityWarning to true", async () => {
    await mkdir(testDir, { recursive: true });
    const settings = getDefaultSettings();
    settings.general = { showSecurityWarning: false };
    await saveSettings(settingsPath, settings);
    const result = await updateGeneralSettings(settingsPath, { showSecurityWarning: true });
    expect(result.showSecurityWarning).toBe(true);
  });

  test("updatePluginSetting resets dataDir to default with null", async () => {
    await mkdir(testDir, { recursive: true });
    const settings = getDefaultSettings();
    const claudePlugin = settings.plugins["claude-code"];
    expect(claudePlugin).toBeDefined();
    if (claudePlugin) claudePlugin.dataDir = "/custom/path";
    await saveSettings(settingsPath, settings);

    const result = await updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: null,
    });
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.isCustomDir).toBe(false);
  });

  test("isFirstLaunch returns true when settings file does not exist", async () => {
    // testDir cleaned by afterEach — no settings file present
    const result = await isFirstLaunch(settingsPath);
    expect(result.firstLaunch).toBe(true);
  });

  test("isFirstLaunch returns false when settings file exists", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await isFirstLaunch(settingsPath);
    expect(result.firstLaunch).toBe(false);
  });

  test("resetSettings deletes settings file when it exists", async () => {
    await mkdir(testDir, { recursive: true });
    await saveSettings(settingsPath, getDefaultSettings());
    const result = await resetSettings(settingsPath);
    expect(result.ok).toBe(true);
    expect((await isFirstLaunch(settingsPath)).firstLaunch).toBe(true);
  });

  test("resetSettings is idempotent when file does not exist", async () => {
    const result = await resetSettings(settingsPath);
    expect(result.ok).toBe(true);
  });

  test("completeOnboarding creates settings.json when missing", async () => {
    const result = await completeOnboarding(settingsPath);
    expect(result.ok).toBe(true);
    expect((await isFirstLaunch(settingsPath)).firstLaunch).toBe(false);
    const loaded = await loadSettings(settingsPath);
    expect(loaded.version).toBe(1);
    expect(loaded.plugins["claude-code"]?.enabled).toBe(true);
  });

  test("completeOnboarding does not overwrite existing settings", async () => {
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
