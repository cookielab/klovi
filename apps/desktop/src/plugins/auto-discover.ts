import type { PluginSettings } from "../bun/settings.ts";
import type { ToolPlugin } from "../shared/plugin-types.ts";
import { BUILTIN_PLUGIN_DESCRIPTORS } from "./catalog.ts";
import { PluginRegistry } from "./registry.ts";

function hasDataDir(plugin: ToolPlugin): Promise<boolean> {
  if (plugin.isDataAvailable) {
    return plugin.isDataAvailable();
  }

  const dataDir = plugin.getDefaultDataDir();
  if (!dataDir) return Promise.resolve(false);
  return Bun.file(dataDir).exists();
}

export async function createRegistry(settings?: PluginSettings): Promise<PluginRegistry> {
  const registry = new PluginRegistry();

  // Reset all dirs to defaults first, then apply custom paths.
  // This prevents stale custom paths from persisting across registry re-creations.
  if (settings) {
    for (const { plugin, setDir, defaultDir } of BUILTIN_PLUGIN_DESCRIPTORS) {
      const pluginConf = settings.plugins[plugin.id];
      setDir(pluginConf?.dataDir ?? defaultDir);
    }
  }

  for (const { plugin } of BUILTIN_PLUGIN_DESCRIPTORS) {
    const pluginSettings = settings?.plugins[plugin.id];

    // If settings exist and plugin is disabled, skip it
    if (pluginSettings && !pluginSettings.enabled) continue;

    if (await hasDataDir(plugin)) {
      registry.register(plugin);
    }
  }

  return registry;
}
