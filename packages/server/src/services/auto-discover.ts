import { runPluginEffect } from "../effect/plugin-runtime.ts";
import { BUILTIN_PLUGIN_DESCRIPTORS } from "./catalog.ts";
import { PluginRegistry } from "./registry.ts";
import type { PluginSettings } from "./settings.ts";

export async function createRegistry(settings?: PluginSettings): Promise<PluginRegistry> {
	const registry = new PluginRegistry();

	for (const { plugin, defaultDir } of BUILTIN_PLUGIN_DESCRIPTORS) {
		const pluginSettings = settings?.plugins[plugin.id];

		// If settings exist and plugin is disabled, skip it
		if (pluginSettings && !pluginSettings.enabled) {
			continue;
		}

		const dataDir = pluginSettings?.dataDir ?? defaultDir;

		const available = await runPluginEffect(plugin.isDataAvailable, { dataDir: dataDir }).catch(() => false);

		if (available) {
			registry.register(plugin, { dataDir: dataDir });
		}
	}

	return registry;
}
