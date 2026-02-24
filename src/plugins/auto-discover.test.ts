import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginSettings } from "../bun/settings.ts";
import { getDefaultSettings } from "../bun/settings.ts";
import { createRegistry } from "./auto-discover.ts";
import {
  getClaudeCodeDir,
  getCodexCliDir,
  getOpenCodeDir,
  setClaudeCodeDir,
  setCodexCliDir,
  setOpenCodeDir,
} from "./config.ts";

const testDir = join(tmpdir(), `klovi-registry-test-${Date.now()}`);

describe("createRegistry with settings", () => {
  let origClaude: string;
  let origCodex: string;
  let origOpenCode: string;

  beforeEach(() => {
    origClaude = getClaudeCodeDir();
    origCodex = getCodexCliDir();
    origOpenCode = getOpenCodeDir();
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    setClaudeCodeDir(origClaude);
    setCodexCliDir(origCodex);
    setOpenCodeDir(origOpenCode);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("disabled plugin is not registered even if dir exists", () => {
    const claudeDir = join(testDir, ".claude");
    mkdirSync(join(claudeDir, "projects"), { recursive: true });
    setClaudeCodeDir(claudeDir);

    const settings: PluginSettings = {
      ...getDefaultSettings(),
      plugins: {
        ...getDefaultSettings().plugins,
        "claude-code": { enabled: false, dataDir: null },
      },
    };

    const registry = createRegistry(settings);
    expect(registry.getAllPlugins().find((p) => p.id === "claude-code")).toBeUndefined();
  });

  test("custom dataDir is used for discovery", () => {
    const customDir = join(testDir, "custom-claude");
    mkdirSync(join(customDir, "projects"), { recursive: true });

    const settings: PluginSettings = {
      ...getDefaultSettings(),
      plugins: {
        ...getDefaultSettings().plugins,
        "claude-code": { enabled: true, dataDir: customDir },
      },
    };

    const registry = createRegistry(settings);
    const plugin = registry.getAllPlugins().find((p) => p.id === "claude-code");
    expect(plugin).toBeDefined();
  });

  test("without settings argument, behaves as before (all enabled, default dirs)", () => {
    const registry = createRegistry();
    expect(registry).toBeDefined();
  });
});
