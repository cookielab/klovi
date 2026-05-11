import type { SqliteDb } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { getCursorGlobalDbPath, getCursorWorkspaceStorageDir } from "./config";

export function openCursorDbIfExists(
	dbPath: string,
): Effect.Effect<SqliteDb | null, never, FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(dbPath).pipe(Effect.catchAll(() => Effect.succeed(false)));
		if (!exists) {
			return null;
		}

		const client = yield* SqliteClientTag;
		return yield* client.open(dbPath, { readonly: true });
	});
}

export function openCursorGlobalDb(): Effect.Effect<SqliteDb | null, never, FileSystem.FileSystem | SqliteClientTag> {
	return openCursorDbIfExists(getCursorGlobalDbPath());
}

export function getCursorWorkspaceStorageDirEffect(): Effect.Effect<string> {
	return Effect.succeed(getCursorWorkspaceStorageDir());
}
