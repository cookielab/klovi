// src/bun/settings.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginSettings } from "./settings.ts";
import { getDefaultSettings, loadSettings, saveSettings } from "./settings.ts";

const testDir = join(tmpdir(), `klovi-settings-test-${Date.now()}`);

function settingsPath(): string {
  return join(testDir, "settings.json");
}

describe("settings", () => {
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test("getDefaultSettings returns all plugins enabled with null dataDirs", () => {
    const settings = getDefaultSettings();
    expect(settings.version).toBe(1);
    expect(settings.plugins["claude-code"]).toEqual({ enabled: true, dataDir: null });
    expect(settings.plugins["codex-cli"]).toEqual({ enabled: true, dataDir: null });
    expect(settings.plugins.opencode).toEqual({ enabled: true, dataDir: null });
  });

  test("loadSettings returns defaults when file does not exist", () => {
    const settings = loadSettings(join(testDir, "nonexistent", "settings.json"));
    expect(settings).toEqual(getDefaultSettings());
  });

  test("saveSettings writes and loadSettings reads back", () => {
    mkdirSync(testDir, { recursive: true });
    const path = settingsPath();
    const settings: PluginSettings = {
      version: 1,
      plugins: {
        "claude-code": { enabled: false, dataDir: "/custom/path" },
        "codex-cli": { enabled: true, dataDir: null },
        opencode: { enabled: true, dataDir: null },
      },
    };
    saveSettings(path, settings);
    const loaded = loadSettings(path);
    expect(loaded).toEqual(settings);
  });

  test("saveSettings creates parent directories", () => {
    const deep = join(testDir, "a", "b", "settings.json");
    saveSettings(deep, getDefaultSettings());
    expect(existsSync(deep)).toBe(true);
  });

  test("loadSettings returns defaults for corrupted JSON", () => {
    mkdirSync(testDir, { recursive: true });
    const path = settingsPath();
    Bun.write(path, "not valid json{{{");
    const settings = loadSettings(path);
    expect(settings).toEqual(getDefaultSettings());
  });
});
