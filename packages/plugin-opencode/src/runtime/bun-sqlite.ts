import type { SqliteClient, SqliteDb } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { Effect, Layer } from "effect";

const BUN_SQLITE_MODULE = "bun:sqlite" as const;

type DatabaseConstructor = new (path: string, options?: { readonly?: boolean }) => SqliteDb;

type BunSqliteModule = Record<"Database", DatabaseConstructor>;

const bunSqliteClient: SqliteClient = {
	open: (dbPath, options) =>
		Effect.tryPromise({
			try: async () => {
				// Dynamic import to avoid hard dependency on bun:sqlite at module level
				const sqlite = (await import(BUN_SQLITE_MODULE)) as BunSqliteModule;
				return new sqlite.Database(dbPath, {
					readonly: options?.readonly ?? true,
				});
			},
			catch: () => null as SqliteDb | null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null as SqliteDb | null))),
};

export const BunSqliteLayer = Layer.succeed(SqliteClientTag, bunSqliteClient);
