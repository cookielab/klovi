import type { PluginProject, SessionSummary, SqliteDb } from "@cookielab.io/klovi-plugin-core";
import { epochMsToIso } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { openOpenCodeDb } from "./db";
import { tryParseJson } from "./shared/json-utils";

// --- Schema introspection ---

type TableColumn = {
	name: string;
};

function getColumns(db: SqliteDb, tableName: string): Set<string> {
	const rows = db.query<TableColumn>(`PRAGMA table_info(${tableName})`).all();
	return new Set(rows.map((r) => r.name));
}

type OpenCodeSchema = {
	hasProjectTable: boolean;
	hasRequiredTables: boolean;
	projectColumns: Set<string>;
	sessionColumns: Set<string>;
};

function inspectSchema(db: SqliteDb): OpenCodeSchema {
	const tableRows = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'").all();
	const tables = new Set(tableRows.map((row) => row.name));

	const hasSessionTable = tables.has("session");
	const hasMessageTable = tables.has("message");
	const hasPartTable = tables.has("part");
	const hasProjectTable = tables.has("project");
	const hasRequiredTables = hasSessionTable && hasMessageTable && hasPartTable;

	return {
		hasProjectTable: hasProjectTable,
		hasRequiredTables: hasRequiredTables,
		projectColumns: hasProjectTable ? getColumns(db, "project") : new Set<string>(),
		sessionColumns: hasSessionTable ? getColumns(db, "session") : new Set<string>(),
	};
}

// --- Row types ---

type ProjectRow = {
	id: string;
	worktree: string;
	name: string | null;
};

type SessionRow = {
	id: string;
	project_id: string;
	directory: string;
	title: string;
	slug: string;
	time_created: number;
	time_updated: number;
};

type MessageDataJson = {
	role: "user" | "assistant";
	modelID?: string;
	providerID?: string;
	time?: { created?: number };
	agent?: string;
};

type MessageRow = {
	id: string;
	session_id: string;
	time_created: number;
	data: string;
};

type PartDataJson = {
	type: string;
	text?: string;
};

type SessionPreview = {
	firstMessage: string;
	model: string;
};

// --- Discovery ---

function discoverOpenCodeProjects() {
	return Effect.gen(function* () {
		const db = yield* openOpenCodeDb();
		if (!db) {
			return [] as PluginProject[];
		}

		try {
			const schema = inspectSchema(db);
			if (!schema.hasRequiredTables) {
				return [] as PluginProject[];
			}

			// Try to discover projects from the project table first
			if (schema.hasProjectTable) {
				return discoverFromProjectTable(db, schema);
			}

			// Fallback: discover from session directories
			return discoverFromSessions(db, schema);
		} catch {
			return [] as PluginProject[];
		} finally {
			db.close();
		}
	});
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
		lastActivity: epochMsToIso(row.last_activity),
	}));
}

function discoverFromSessions(db: SqliteDb, schema: OpenCodeSchema): PluginProject[] {
	const hasDirectory = schema.sessionColumns.has("directory");
	const hasProjectId = schema.sessionColumns.has("project_id");

	if (!(hasDirectory || hasProjectId)) {
		return [];
	}

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
		lastActivity: epochMsToIso(row.last_activity),
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
	const preview = getSessionPreview(db, row.id);
	const firstMessage = row.title || preview.firstMessage || "OpenCode session";

	return {
		sessionId: row.id,
		timestamp: epochMsToIso(row.time_created),
		slug: row.slug,
		firstMessage: firstMessage,
		model: preview.model || "unknown",
		gitBranch: "",
		pluginId: "opencode",
	};
}

function listOpenCodeSessions(nativeId: string) {
	return Effect.gen(function* () {
		const db = yield* openOpenCodeDb();
		if (!db) {
			return [] as SessionSummary[];
		}

		try {
			const schema = inspectSchema(db);
			if (!schema.hasRequiredTables) {
				return [] as SessionSummary[];
			}
			const sessionRows = querySessionRows(db, schema, nativeId);
			return sessionRows.map((row) => sessionRowToSummary(db, row));
		} catch {
			return [] as SessionSummary[];
		} finally {
			db.close();
		}
	});
}

function getSessionPreview(db: SqliteDb, sessionId: string): SessionPreview {
	const preview: SessionPreview = { firstMessage: "", model: "" };

	const msgRow = db
		.query<MessageRow>(
			`SELECT id, session_id, time_created, data FROM message
       WHERE session_id = ?
       ORDER BY time_created ASC
       LIMIT 10`,
		)
		.all(sessionId);

	for (const msg of msgRow) {
		const data = tryParseJson<MessageDataJson>(msg.data);
		if (!data) {
			continue;
		}

		assignPreviewModel(preview, data);
		assignPreviewFirstMessage(preview, data, db, msg.id);

		if (preview.firstMessage && preview.model) {
			break;
		}
	}

	return preview;
}

function assignPreviewModel(preview: SessionPreview, data: MessageDataJson): void {
	if (preview.model || data.role !== "assistant" || !data.modelID) {
		return;
	}
	preview.model = data.modelID;
}

function assignPreviewFirstMessage(
	preview: SessionPreview,
	data: MessageDataJson,
	db: SqliteDb,
	messageId: string,
): void {
	if (preview.firstMessage || data.role !== "user") {
		return;
	}
	preview.firstMessage = getFirstUserTextPart(db, messageId);
}

function getFirstUserTextPart(db: SqliteDb, messageId: string): string {
	const parts = db.query<{ data: string }>("SELECT data FROM part WHERE message_id = ? ORDER BY id ASC").all(messageId);

	for (const part of parts) {
		const partData = tryParseJson<PartDataJson>(part.data);
		if (partData?.type === "text" && partData.text) {
			const maxPreviewLength = 200;
			return partData.text.slice(0, maxPreviewLength);
		}
	}

	return "";
}

export { discoverOpenCodeProjects, listOpenCodeSessions };
