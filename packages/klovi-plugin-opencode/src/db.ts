import { existsSync } from "node:fs";
import { join } from "node:path";
import { getOpenCodeDir } from "./config.ts";

export interface SqliteQuery<T = unknown> {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | undefined;
}

export interface SqliteDb {
  query<T = unknown>(sql: string): SqliteQuery<T>;
  close(): void;
}

export function getOpenCodeDbPath(): string {
  return join(getOpenCodeDir(), "opencode.db");
}

export async function openOpenCodeDb(): Promise<SqliteDb | null> {
  const dbPath = getOpenCodeDbPath();
  if (!existsSync(dbPath)) return null;

  try {
    const sqlite = await import("bun:sqlite");
    return new sqlite.Database(dbPath, { readonly: true }) as unknown as SqliteDb;
  } catch {
    return null;
  }
}
