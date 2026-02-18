import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginProject } from "../../../shared/plugin-types.ts";
import type { SessionSummary } from "../../../shared/types.ts";
import { getOpenCodeDir } from "../../config.ts";

// --- DB path helpers ---

export function getDbPath(): string {
  return join(getOpenCodeDir(), "opencode.db");
}

interface SqliteQuery<T = unknown> {
  all(...params: any[]): any[];
  get(...params: any[]): any;
}

interface SqliteDb {
  query<T = unknown>(sql: string): SqliteQuery<T>;
  close(): void;
}

async function openDb(): Promise<SqliteDb | null> {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return null;
  try {
    const sqlite = await import("bun:sqlite");
    return new sqlite.Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

// --- Schema introspection ---

interface TableColumn {
  name: string;
}

function tableExists(db: SqliteDb, tableName: string): boolean {
  const row = db
    .query<{ cnt: number }>(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?",
    )
    .get(tableName);
  return (row?.cnt ?? 0) > 0;
}

function getColumns(db: SqliteDb, tableName: string): string[] {
  const rows = db.query<TableColumn>(`PRAGMA table_info(${tableName})`).all();
  return rows.map((r) => r.name);
}

function hasRequiredTables(db: SqliteDb): boolean {
  return tableExists(db, "session") && tableExists(db, "message") && tableExists(db, "part");
}

// --- Row types ---

interface ProjectRow {
  id: string;
  worktree: string;
  name: string | null;
}

interface SessionRow {
  id: string;
  project_id: string;
  directory: string;
  title: string;
  slug: string;
  time_created: number;
  time_updated: number;
}

interface MessageDataJson {
  role: "user" | "assistant";
  modelID?: string;
  providerID?: string;
  time?: { created?: number };
  agent?: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
}

interface PartDataJson {
  type: string;
  text?: string;
}

// --- Discovery ---

export async function discoverOpenCodeProjects(): Promise<PluginProject[]> {
  const db = await openDb();
  if (!db) return [];

  try {
    if (!hasRequiredTables(db)) return [];

    const hasProjectTable = tableExists(db, "project");

    // Try to discover projects from the project table first
    if (hasProjectTable) {
      return discoverFromProjectTable(db);
    }

    // Fallback: discover from session directories
    return discoverFromSessions(db);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function discoverFromProjectTable(db: SqliteDb): PluginProject[] {
  const cols = getColumns(db, "project");
  const hasWorktree = cols.includes("worktree");
  const hasName = cols.includes("name");

  if (!hasWorktree) {
    // Can't determine project paths without worktree
    return discoverFromSessions(db);
  }

  const selectName = hasName ? "p.name" : "NULL as name";

    const rows = db
      .query<ProjectRow & { session_count: number; last_activity: number }>(
        `SELECT p.id, p.worktree, ${selectName},
              count(s.id) as session_count,
              coalesce(max(s.time_updated), max(s.time_created), p.time_created) as last_activity
       FROM project p
       LEFT JOIN session s ON s.project_id = p.id
       GROUP BY p.id
       HAVING session_count > 0
       ORDER BY last_activity DESC`,
    )
    .all();

  return rows.map((row) => ({
    pluginId: "opencode",
    nativeId: row.id,
    resolvedPath: row.worktree,
    displayName: row.name || row.worktree,
    sessionCount: row.session_count,
    lastActivity: new Date(row.last_activity).toISOString(),
  }));
}

function discoverFromSessions(db: SqliteDb): PluginProject[] {
  const cols = getColumns(db, "session");
  const hasDirectory = cols.includes("directory");
  const hasProjectId = cols.includes("project_id");

  if (!hasDirectory && !hasProjectId) return [];

  const groupCol = hasDirectory ? "directory" : "project_id";

  const rows = db
    .query<{ group_key: string; session_count: number; last_activity: number }>(
      `SELECT ${groupCol} as group_key,
              count(*) as session_count,
              coalesce(max(time_updated), max(time_created)) as last_activity
       FROM session
       GROUP BY ${groupCol}
       ORDER BY last_activity DESC`,
    )
    .all();

  return rows.map((row) => ({
    pluginId: "opencode",
    nativeId: row.group_key,
    resolvedPath: row.group_key,
    displayName: row.group_key,
    sessionCount: row.session_count,
    lastActivity: new Date(row.last_activity).toISOString(),
  }));
}

// --- Session listing ---

function querySessionRows(db: SqliteDb, nativeId: string): SessionRow[] {
  const hasProjectTable = tableExists(db, "project");
  const sessionCols = getColumns(db, "session");
  const titleCol = sessionCols.includes("title") ? "title" : "''";
  const slugCol = sessionCols.includes("slug") ? "slug" : "id";
  const whereCol = hasProjectTable ? "project_id" : "directory";

  return db
    .query<SessionRow>(
      `SELECT id, project_id, directory, ${titleCol} as title,
              ${slugCol} as slug, time_created, time_updated
       FROM session
       WHERE ${whereCol} = ?
       ORDER BY time_created DESC`,
    )
    .all(nativeId);
}

function sessionRowToSummary(db: SqliteDb, row: SessionRow): SessionSummary {
  const firstMessage = row.title || getFirstUserMessage(db, row.id) || "OpenCode session";
  const model = getSessionModel(db, row.id);

  return {
    sessionId: row.id,
    timestamp: new Date(row.time_created).toISOString(),
    slug: row.slug,
    firstMessage,
    model: model || "unknown",
    gitBranch: "",
    pluginId: "opencode",
  };
}

export async function listOpenCodeSessions(nativeId: string): Promise<SessionSummary[]> {
  const db = await openDb();
  if (!db) return [];

  try {
    if (!hasRequiredTables(db)) return [];
    const sessionRows = querySessionRows(db, nativeId);
    return sessionRows.map((row) => sessionRowToSummary(db, row));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function getFirstUserMessage(db: SqliteDb, sessionId: string): string | null {
  // Get the first message for this session
  const msgRow = db
    .query<MessageRow>(
      `SELECT id, session_id, time_created, data FROM message
       WHERE session_id = ?
       ORDER BY time_created ASC
       LIMIT 5`,
    )
    .all(sessionId);

  for (const msg of msgRow) {
    try {
      const data = JSON.parse(msg.data) as MessageDataJson;
      if (data.role !== "user") continue;

      // Get text parts for this message
      const parts = db
        .query<{ data: string }>(
          "SELECT data FROM part WHERE message_id = ? ORDER BY id ASC",
        )
        .all(msg.id);

      for (const part of parts) {
        try {
          const partData = JSON.parse(part.data) as PartDataJson;
          if (partData.type === "text" && partData.text) {
            return partData.text.slice(0, 200);
          }
        } catch {
          // Skip malformed part data
        }
      }
    } catch {
      // Skip malformed message data
    }
  }

  return null;
}

function getSessionModel(db: SqliteDb, sessionId: string): string {
  const msgRow = db
    .query<MessageRow>(
      `SELECT id, session_id, time_created, data FROM message
       WHERE session_id = ?
       ORDER BY time_created ASC
       LIMIT 10`,
    )
    .all(sessionId);

  for (const msg of msgRow) {
    try {
      const data = JSON.parse(msg.data) as MessageDataJson;
      if (data.role === "assistant" && data.modelID) {
        return data.modelID;
      }
    } catch {
      // Skip malformed data
    }
  }

  return "";
}
