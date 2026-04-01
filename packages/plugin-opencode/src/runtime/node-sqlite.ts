import type { SqliteClient, SqliteDb, SqliteQuery } from "@cookielab.io/klovi-plugin-core";
import { SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { Effect, Layer } from "effect";

const nodeSqliteClient: SqliteClient = {
	open: (dbPath, options) =>
		Effect.tryPromise({
			try: async () => {
				// Node.js built-in SQLite (available in Node 22.5+)
				const sqlite = await import("node:sqlite");
				const db = new sqlite.DatabaseSync(dbPath, {
					open: true,
					readOnly: options?.readonly ?? true,
				} as never);
				return {
					query: <T = unknown>(sql: string): SqliteQuery<T> => {
						const stmt = db.prepare(sql);
						return {
							all: (...params: unknown[]): T[] => stmt.all(...(params as never[])) as T[],
							get: (...params: unknown[]): T | undefined => stmt.get(...(params as never[])) as T | undefined,
						};
					},
					close: () => {
						db.close();
					},
				} satisfies SqliteDb;
			},
			catch: () => null as SqliteDb | null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null as SqliteDb | null))),
};

export const NodeSqliteLayer = Layer.succeed(SqliteClientTag, nodeSqliteClient);
