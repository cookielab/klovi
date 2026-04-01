import { Context, type Effect } from "effect";

export type SqliteQuery<T = unknown> = {
	all: (...params: unknown[]) => T[];
	get: (...params: unknown[]) => T | undefined;
};

export type SqliteDb = {
	query: <T = unknown>(sql: string) => SqliteQuery<T>;
	close: () => void;
};

export type SqliteClient = {
	readonly open: (dbPath: string, options?: { readonly: boolean }) => Effect.Effect<SqliteDb | null, never, never>;
};

export class SqliteClientTag extends Context.Tag("@klovi/SqliteClient")<SqliteClientTag, SqliteClient>() {}
