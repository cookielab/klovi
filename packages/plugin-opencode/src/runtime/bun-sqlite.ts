import type { SqliteClient, SqliteDb } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { Effect, Layer } from "effect";

const bunSqliteClient: SqliteClient = {
	open: (dbPath, options) =>
		Effect.try({
			try: () => {
				// Dynamic require to avoid hard dependency on bun:sqlite at module level
				// biome-ignore lint/style/noCommonJs: bun:sqlite must be require'd dynamically
				const sqlite = require("bun:sqlite");
				return new sqlite.Database(dbPath, {
					readonly: options?.readonly ?? true,
				}) as unknown as SqliteDb;
			},
			catch: () => null as SqliteDb | null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null as SqliteDb | null))),
};

export const BunSqliteLayer = Layer.succeed(SqliteClientTag, bunSqliteClient);
