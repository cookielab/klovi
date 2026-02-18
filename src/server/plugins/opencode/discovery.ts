import type { PluginProject } from "../../../shared/plugin-types.ts";
import type { SessionSummary } from "../../../shared/types.ts";
import { openOpenCodeDb, type SqliteDb } from "./db.ts";

export { getOpenCodeDbPath as getDbPath } from "./db.ts";

// --- Schema introspection ---

interface TableColumn {
  name: string;
}

function getColumns(db: SqliteDb, tableName: string): Set<string> {
  const rows = db.query<TableColumn>(`PRAGMA table_info(${tableName})`).all();
  return new Set(rows.map((r) => r.name));
}

interface OpenCodeSchema {
  hasProjectTable: boolean;
  hasRequiredTables: boolean;
  projectColumns: Set<string>;
  sessionColumns: Set<string>;
}

function inspectSchema(db: SqliteDb): OpenCodeSchema {
  const tableRows = db
    .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  const tables = new Set(tableRows.map((row) => row.name));

  const hasSessionTable = tables.has("session");
  const hasMessageTable = tables.has("message");
  const hasPartTable = tables.has("part");
  const hasProjectTable = tables.has("project");
  const hasRequiredTables = hasSessionTable && hasMessageTable && hasPartTable;

  return {
    hasProjectTable,
    hasRequiredTables,
    projectColumns: hasProjectTable ? getColumns(db, "project") : new Set<string>(),
    sessionColumns: hasSessionTable ? getColumns(db, "session") : new Set<string>(),
  };
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
  const db = await openOpenCodeDb();
  if (!db) return [];

  try {
    const schema = inspectSchema(db);
    if (!schema.hasRequiredTables) return [];

    // Try to discover projects from the project table first
    if (schema.hasProjectTable) {
      return discoverFromProjectTable(db, schema);
    }

    // Fallback: discover from session directories
    return discoverFromSessions(db, schema);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function discoverFromProjectTable(db: SqliteDb, schema: OpenCodeSchema): PluginProject[] {
  const hasWorktree = schema.projectColumns.has("worktree");
  const hasName = schema.projectColumns.has("name");

  if (!hasWorktree) {
    // Can't determine project paths without worktree
    return discoverFromSessions(db, schema);
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

function discoverFromSessions(db: SqliteDb, schema: OpenCodeSchema): PluginProject[] {
  const hasDirectory = schema.sessionColumns.has("directory");
  const hasProjectId = schema.sessionColumns.has("project_id");

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

function querySessionRows(db: SqliteDb, schema: OpenCodeSchema, nativeId: string): SessionRow[] {
  const titleCol = schema.sessionColumns.has("title") ? "title" : "''";
  const slugCol = schema.sessionColumns.has("slug") ? "slug" : "id";
  const whereCol = schema.hasProjectTable ? "project_id" : "directory";

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
  const db = await openOpenCodeDb();
  if (!db) return [];

  try {
    const schema = inspectSchema(db);
    if (!schema.hasRequiredTables) return [];
    const sessionRows = querySessionRows(db, schema, nativeId);
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
