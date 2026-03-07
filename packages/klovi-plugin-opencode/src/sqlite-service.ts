import { Context, type Effect } from "effect";

export interface SqliteQuery<T = unknown> {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | undefined;
}

export interface SqliteDb {
  query<T = unknown>(sql: string): SqliteQuery<T>;
  close(): void;
}

export interface SqliteClient {
  readonly open: (
    dbPath: string,
    options?: { readonly: boolean },
  ) => Effect.Effect<SqliteDb | null, never, never>;
}

export class SqliteClientTag extends Context.Tag("@klovi/SqliteClient")<
  SqliteClientTag,
  SqliteClient
>() {}
