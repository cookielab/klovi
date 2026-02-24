import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginSettings } from "../bun/settings.ts";
import type { ToolPlugin } from "../shared/plugin-types.ts";
import { claudeCodePlugin } from "./claude-code/index.ts";
import { codexCliPlugin } from "./codex-cli/index.ts";
import { setClaudeCodeDir, setCodexCliDir, setOpenCodeDir } from "./config.ts";
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
    { plugin: claudeCodePlugin, setDir: setClaudeCodeDir },
    { plugin: codexCliPlugin, setDir: setCodexCliDir },
    { plugin: openCodePlugin, setDir: setOpenCodeDir },
  ] as const;

  for (const { plugin, setDir } of allPlugins) {
    const pluginSettings = settings?.plugins[plugin.id];

    // If settings exist and plugin is disabled, skip it
    if (pluginSettings && !pluginSettings.enabled) continue;

    // Apply custom dataDir if set
    if (pluginSettings?.dataDir) {
      setDir(pluginSettings.dataDir);
    }

    if (hasDataDir(plugin)) {
      registry.register(plugin);
    }
  }

  return registry;
}
