import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginSettings } from "../bun/settings.ts";
import type { ToolPlugin } from "../shared/plugin-types.ts";
import { claudeCodePlugin } from "./claude-code/index.ts";
import { codexCliPlugin } from "./codex-cli/index.ts";
import {
  DEFAULT_CLAUDE_CODE_DIR,
  DEFAULT_CODEX_CLI_DIR,
  DEFAULT_OPENCODE_DIR,
  setClaudeCodeDir,
  setCodexCliDir,
  setOpenCodeDir,
} from "./config.ts";
import { openCodePlugin } from "./opencode/index.ts";
import { PluginRegistry } from "./registry.ts";

function hasDataDir(plugin: ToolPlugin): boolean {
  const dataDir = plugin.getDefaultDataDir();
  if (!dataDir) return false;

  // OpenCode needs the actual DB file
  if (plugin.id === "opencode") {
    return existsSync(join(dataDir, "opencode.db"));
  }
  return existsSync(dataDir);
}

export function createRegistry(settings?: PluginSettings): PluginRegistry {
  const registry = new PluginRegistry();

  const allPlugins = [
    { plugin: claudeCodePlugin, setDir: setClaudeCodeDir, defaultDir: DEFAULT_CLAUDE_CODE_DIR },
    { plugin: codexCliPlugin, setDir: setCodexCliDir, defaultDir: DEFAULT_CODEX_CLI_DIR },
    { plugin: openCodePlugin, setDir: setOpenCodeDir, defaultDir: DEFAULT_OPENCODE_DIR },
  ] as const;

  // Reset all dirs to defaults first, then apply custom paths.
  // This prevents stale custom paths from persisting across registry re-creations.
  if (settings) {
    for (const { plugin, setDir, defaultDir } of allPlugins) {
      const pluginConf = settings.plugins[plugin.id];
      setDir(pluginConf?.dataDir ?? defaultDir);
    }
  }

  for (const { plugin } of allPlugins) {
    const pluginSettings = settings?.plugins[plugin.id];

    // If settings exist and plugin is disabled, skip it
    if (pluginSettings && !pluginSettings.enabled) continue;

    if (hasDataDir(plugin)) {
      registry.register(plugin);
    }
  }

  return registry;
}
