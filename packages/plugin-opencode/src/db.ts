import { join } from "node:path";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

export function getOpenCodeDbPath() {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		return join(config.dataDir, "opencode.db");
	});
}

export function openOpenCodeDb() {
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
