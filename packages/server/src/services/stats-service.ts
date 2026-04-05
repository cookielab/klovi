import type { DashboardStats, RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import type { PluginRegistry } from "./registry.ts";
import { scanStats } from "./stats.ts";

function getStats(registry: PluginRegistry): Effect.Effect<{ stats: DashboardStats }, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const stats = yield* scanStats(registry);
		return { stats: stats };
	});
}

export { getStats };
