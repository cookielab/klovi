import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getGeneralSettings,
  getPluginSettings,
  isFirstLaunch,
  resetSettings,
  updateGeneralSettings,
  updatePluginSetting,
} from "./rpc-handlers.ts";
import { getDefaultSettings, loadSettings, saveSettings } from "./settings.ts";

const testDir = join(tmpdir(), `klovi-handlers-test-${Date.now()}`);
const settingsPath = join(testDir, "settings.json");

describe("settings RPC handlers", () => {
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("getPluginSettings returns all three plugins", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = getPluginSettings(settingsPath);
    expect(result.plugins).toHaveLength(3);
    expect(result.plugins.map((p) => p.id)).toEqual(["claude-code", "codex-cli", "opencode"]);
  });

  test("getPluginSettings shows enabled and default dirs", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = getPluginSettings(settingsPath);
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.enabled).toBe(true);
    expect(claude?.isCustomDir).toBe(false);
    expect(claude?.dataDir).toBe(claude?.defaultDataDir);
  });

  test("updatePluginSetting disables a plugin", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, { pluginId: "claude-code", enabled: false });
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.enabled).toBe(false);

    // Verify persisted
    const loaded = loadSettings(settingsPath);
    expect(loaded.plugins["claude-code"]?.enabled).toBe(false);
  });

  test("updatePluginSetting sets custom dataDir", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: "/custom/path",
    });
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.dataDir).toBe("/custom/path");
    expect(claude?.isCustomDir).toBe(true);
  });

  test("getGeneralSettings returns true by default", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = getGeneralSettings(settingsPath);
    expect(result.showSecurityWarning).toBe(true);
  });

  test("getGeneralSettings returns true for legacy settings without general", () => {
    mkdirSync(testDir, { recursive: true });
    const settings = getDefaultSettings();
    delete settings.general;
    saveSettings(settingsPath, settings);
    const result = getGeneralSettings(settingsPath);
    expect(result.showSecurityWarning).toBe(true);
  });

  test("updateGeneralSettings sets showSecurityWarning to false", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updateGeneralSettings(settingsPath, { showSecurityWarning: false });
    expect(result.showSecurityWarning).toBe(false);

    // Verify persisted
    const loaded = loadSettings(settingsPath);
    expect(loaded.general?.showSecurityWarning).toBe(false);
  });

  test("updateGeneralSettings sets showSecurityWarning to true", () => {
    mkdirSync(testDir, { recursive: true });
    const settings = getDefaultSettings();
    settings.general = { showSecurityWarning: false };
    saveSettings(settingsPath, settings);
    const result = updateGeneralSettings(settingsPath, { showSecurityWarning: true });
    expect(result.showSecurityWarning).toBe(true);
  });

  test("updatePluginSetting resets dataDir to default with null", () => {
    mkdirSync(testDir, { recursive: true });
    const settings = getDefaultSettings();
    const claudePlugin = settings.plugins["claude-code"];
    expect(claudePlugin).toBeDefined();
    if (claudePlugin) claudePlugin.dataDir = "/custom/path";
    saveSettings(settingsPath, settings);

    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: null,
    });
    const claude = result.plugins.find((p) => p.id === "claude-code");
    expect(claude).toBeDefined();
    expect(claude?.isCustomDir).toBe(false);
  });

  test("isFirstLaunch returns true when settings file does not exist", () => {
    // testDir cleaned by afterEach — no settings file present
    const result = isFirstLaunch(settingsPath);
    expect(result.firstLaunch).toBe(true);
  });

  test("isFirstLaunch returns false when settings file exists", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = isFirstLaunch(settingsPath);
    expect(result.firstLaunch).toBe(false);
  });

  test("resetSettings deletes settings file when it exists", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = resetSettings(settingsPath);
    expect(result.ok).toBe(true);
    expect(isFirstLaunch(settingsPath).firstLaunch).toBe(true);
  });

  test("resetSettings is idempotent when file does not exist", () => {
    const result = resetSettings(settingsPath);
    expect(result.ok).toBe(true);
  });
});
