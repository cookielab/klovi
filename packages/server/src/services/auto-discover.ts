import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { BUILTIN_PLUGIN_DESCRIPTORS } from "./catalog";
import { PluginRegistry } from "./registry";
import type { PluginSettings } from "./settings";

export function createRegistry(settings?: PluginSettings): Effect.Effect<PluginRegistry, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const registry = new PluginRegistry();

		for (const { plugin, defaultDir, defaultEnabled } of BUILTIN_PLUGIN_DESCRIPTORS) {
			const pluginSettings = settings?.plugins[plugin.id];
			const enabled = pluginSettings?.enabled ?? defaultEnabled;

			if (!enabled) {
				continue;
			}

			const dataDir = pluginSettings?.dataDir ?? defaultDir;
			const configLayer = makePluginConfigLayer({ dataDir: dataDir });

			const available = yield* plugin.isDataAvailable.pipe(
				Effect.provide(configLayer),
				Effect.catchAll(() => Effect.succeed(false)),
			);

			if (available) {
				registry.register(plugin, { dataDir: dataDir });
			}
		}

		return registry;
	});
}
