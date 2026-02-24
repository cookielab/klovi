import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPluginSettings, updatePluginSetting } from "./rpc-handlers.ts";
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
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.enabled).toBe(true);
    expect(claude.isCustomDir).toBe(false);
    expect(claude.dataDir).toBe(claude.defaultDataDir);
  });

  test("updatePluginSetting disables a plugin", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, { pluginId: "claude-code", enabled: false });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.enabled).toBe(false);

    // Verify persisted
    const loaded = loadSettings(settingsPath);
    expect(loaded.plugins["claude-code"]!.enabled).toBe(false);
  });

  test("updatePluginSetting sets custom dataDir", () => {
    mkdirSync(testDir, { recursive: true });
    saveSettings(settingsPath, getDefaultSettings());
    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: "/custom/path",
    });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.dataDir).toBe("/custom/path");
    expect(claude.isCustomDir).toBe(true);
  });

  test("updatePluginSetting resets dataDir to default with null", () => {
    mkdirSync(testDir, { recursive: true });
    const settings = getDefaultSettings();
    settings.plugins["claude-code"]!.dataDir = "/custom/path";
    saveSettings(settingsPath, settings);

    const result = updatePluginSetting(settingsPath, {
      pluginId: "claude-code",
      dataDir: null,
    });
    const claude = result.plugins.find((p) => p.id === "claude-code")!;
    expect(claude.isCustomDir).toBe(false);
  });
});
