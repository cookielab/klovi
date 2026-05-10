import { join } from "node:path";
import {
	PluginConfig,
	type PluginProject,
	type SessionSummary,
	sortByIsoDesc,
	streamJsonlHead,
} from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { cleanCommandMessage } from "./command-message";
import type { RawContentBlock, RawLine } from "./raw-types";
import { decodeEncodedPath, listFilesBySuffix, listFilesWithMtime, readDirEntriesSafe } from "./shared/discovery-utils";

const BRACKETED_TEXT_REGEX = /^\[.+\]$/u;
const PROJECT_DIR_CONCURRENCY = 16;
const SESSION_FILE_CONCURRENCY = 16;

function inspectProjectSessions(projectDir: string, sessionFiles: { fileName: string; mtime: string }[]) {
	return Effect.gen(function* () {
		const lastActivity = sessionFiles[0]?.mtime || "";
		let resolvedPath = "";

		// sessionFiles is sorted newest-first; try newest first, fall back only on empty result
		for (const sessionFile of sessionFiles) {
			const filePath = join(projectDir, sessionFile.fileName);
			resolvedPath = yield* extractCwd(filePath);
			if (resolvedPath) {
				break;
			}
		}

		return { lastActivity: lastActivity, resolvedPath: resolvedPath };
	});
}

function discoverClaudeProjects() {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const projectsDir = join(config.dataDir, "projects");
		const entries = yield* readDirEntriesSafe(projectsDir);
		const directories = entries.filter((entry) => entry.isDirectory);

		const projects = yield* Effect.forEach(
			directories,
			(entry) =>
				Effect.gen(function* () {
					const projectDir = join(projectsDir, entry.name);
					const sessionFiles = yield* listFilesWithMtime(projectDir, ".jsonl");
					if (sessionFiles.length === 0) {
						return null;
					}

					const projectInfo = yield* inspectProjectSessions(projectDir, sessionFiles);
					const resolvedPath = projectInfo.resolvedPath || decodeEncodedPath(entry.name);

					return {
						pluginId: "claude-code",
						nativeId: entry.name,
						resolvedPath: resolvedPath,
						displayName: resolvedPath,
						sessionCount: sessionFiles.length,
						lastActivity: projectInfo.lastActivity,
					} as PluginProject;
				}),
			{ concurrency: PROJECT_DIR_CONCURRENCY },
		);

		const filtered = projects.filter((p): p is PluginProject => p !== null);
		sortByIsoDesc(filtered, (project) => project.lastActivity);
		return filtered;
	});
}

const PLAN_PREFIX = "Implement the following plan";

function listClaudeSessions(nativeId: string) {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const projectDir = join(config.dataDir, "projects", nativeId);
		const files = yield* listFilesBySuffix(projectDir, ".jsonl");

		const candidates = yield* Effect.forEach(
			files,
			(file) =>
				Effect.gen(function* () {
					const filePath = join(projectDir, file);
					const sessionId = file.replace(".jsonl", "");
					const meta = yield* extractSessionMeta(filePath);
					return meta ? ({ sessionId: sessionId, pluginId: "claude-code", ...meta } as SessionSummary) : null;
				}),
			{ concurrency: SESSION_FILE_CONCURRENCY },
		);

		const sessions = candidates.filter((s): s is SessionSummary => s !== null);
		classifySessionTypes(sessions);
		sortByIsoDesc(sessions, (session) => session.timestamp);
		return sessions;
	});
}

function classifySessionTypes(sessions: SessionSummary[]): void {
	// First pass: mark implementation sessions
	const implSlugs = new Set<string>();
	for (const session of sessions) {
		if (session.firstMessage.startsWith(PLAN_PREFIX)) {
			session.sessionType = "implementation";
			if (session.slug) {
				implSlugs.add(session.slug);
			}
		}
	}

	// Second pass: mark plan sessions (same slug as an implementation session, but not itself one)
	for (const session of sessions) {
		if (!session.sessionType && session.slug && implSlugs.has(session.slug)) {
			session.sessionType = "plan";
		}
	}
}

function extractCwd(filePath: string) {
	return Effect.gen(function* () {
		let cwd = "";
		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				const obj = parsed as RawLine;
				if (obj.cwd) {
					({ cwd } = obj);
					return false;
				}
				return undefined;
			},
			{ maxLines: 20 },
		).pipe(Effect.catchAll(() => Effect.void));
		return cwd;
	});
}

type MetaFields = {
	timestamp: string;
	slug: string;
	firstMessage: string;
	model: string;
	gitBranch: string;
};

function extractTextFromContent(content: string | RawContentBlock[]): string {
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		for (const block of content) {
			if (block.type === "text" && "text" in block) {
				return block.text;
			}
		}
	}
	return "";
}

function isInternalMessage(text: string): boolean {
	return (
		text.startsWith("<local-command") || text.startsWith("<command-name") || BRACKETED_TEXT_REGEX.test(text.trim())
	);
}

function isMetaComplete(meta: MetaFields): boolean {
	return Boolean(meta.timestamp && meta.slug && meta.firstMessage && meta.model && meta.gitBranch);
}

function processMetaLine(obj: RawLine, meta: MetaFields): void {
	if (obj.timestamp && !meta.timestamp) {
		meta.timestamp = obj.timestamp;
	}
	if (obj.slug && !meta.slug) {
		meta.slug = obj.slug;
	}
	if (obj.gitBranch && !meta.gitBranch) {
		meta.gitBranch = obj.gitBranch;
	}
	if (obj.message?.model && !meta.model) {
		meta.model = obj.message.model;
	}

	if (!meta.firstMessage && obj.type === "user" && !obj.isMeta && obj.message) {
		const raw = extractTextFromContent(obj.message.content);
		if (raw && !isInternalMessage(raw)) {
			const maxPreviewLength = 200;
			meta.firstMessage = cleanCommandMessage(raw).slice(0, maxPreviewLength);
		}
	}
}

function extractSessionMeta(filePath: string) {
	return Effect.gen(function* () {
		const meta: MetaFields = {
			timestamp: "",
			slug: "",
			firstMessage: "",
			model: "",
			gitBranch: "",
		};

		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				const obj = parsed as RawLine;
				processMetaLine(obj, meta);
				if (isMetaComplete(meta)) {
					return false;
				}
				return undefined;
			},
			{
				maxLines: 50,
				onMalformed: () => {
					// Malformed lines skipped here; full errors reported by loadClaudeSession()
				},
			},
		).pipe(Effect.catchAll(() => Effect.void));

		if (!(meta.timestamp && meta.firstMessage)) {
			return null;
		}

		return {
			timestamp: meta.timestamp,
			slug: meta.slug || "unknown",
			firstMessage: meta.firstMessage,
			model: meta.model || "unknown",
			gitBranch: meta.gitBranch || "",
		} as Omit<SessionSummary, "sessionId">;
	});
}

export { classifySessionTypes, discoverClaudeProjects, extractCwd, extractSessionMeta, listClaudeSessions };
