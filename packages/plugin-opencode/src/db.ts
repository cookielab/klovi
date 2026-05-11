import { join } from "node:path";
import type { SqliteDb } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { FileSystem, type Error as PlatformError } from "@effect/platform";
import { Effect } from "effect";

export function getOpenCodeDbPath(): Effect.Effect<string, never, PluginConfig> {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		return join(config.dataDir, "opencode.db");
	});
}

export function openOpenCodeDb(): Effect.Effect<
	SqliteDb | null,
	PlatformError.PlatformError,
	PluginConfig | FileSystem.FileSystem | SqliteClientTag
> {
	return Effect.gen(function* () {
		const dbPath = yield* getOpenCodeDbPath();
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(dbPath);
		if (!exists) {
			return null;
		}

		const client = yield* SqliteClientTag;
		return yield* client.open(dbPath, { readonly: true });
	});
}
