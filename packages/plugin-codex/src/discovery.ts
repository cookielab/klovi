import type { PluginProject, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { epochSecondsToIso, sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { type SessionFileInfo, scanCodexSessions } from "./session-index.ts";
import { readFileText, readTextPrefix } from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";

type CodexEvent = {
	type: string;
	item?: {
		type?: string;
		text?: string;
	};
	payload?: {
		type?: string;
		message?: string;
		text?: string;
		[key: string]: unknown;
	};
};

const SESSION_TITLE_SCAN_BYTES = 256 * 1024;

function discoverCodexProjects() {
	return Effect.gen(function* () {
		const sessions = yield* scanCodexSessions();

		// Group by cwd
		const byCwd = new Map<string, SessionFileInfo[]>();
		for (const session of sessions) {
			const existing = byCwd.get(session.meta.cwd);
			if (existing) {
				existing.push(session);
			} else {
				byCwd.set(session.meta.cwd, [session]);
			}
		}

		const projects: PluginProject[] = [];
		for (const [cwd, cwdSessions] of byCwd) {
			let lastActivity = "";
			for (const s of cwdSessions) {
				if (s.mtime > lastActivity) {
					lastActivity = s.mtime;
				}
			}

			projects.push({
				pluginId: "codex-cli",
				nativeId: cwd,
				resolvedPath: cwd,
				displayName: cwd,
				sessionCount: cwdSessions.length,
				lastActivity: lastActivity,
			});
		}

		sortByIsoDesc(projects, (project) => project.lastActivity);
		return projects;
	});
}

function extractFirstUserMessage(text: string): string | null {
	let message: string | null = null;

	iterateJsonl(
		text,
		({ parsed }) => {
			const event = parsed as CodexEvent;

			// Old format: item.completed with agent_message
			if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
				message = event.item.text.slice(0, 200);
				return false;
			}

			// New format: event_msg with user_message payload
			if (event.type === "event_msg" && event.payload?.type === "user_message") {
				const text = event.payload.message || event.payload.text;
				if (typeof text === "string" && text) {
					message = text.slice(0, 200);
					return false;
				}
			}
			// biome-ignore lint/complexity/noUselessUndefined: explicit return needed for TypeScript
			return undefined;
		},
		{ startAt: 1 },
	);

	return message;
}

function listCodexSessions(nativeId: string) {
	return Effect.gen(function* () {
		const allSessions = yield* scanCodexSessions();
		const matching = allSessions.filter((s) => s.meta.cwd === nativeId);

		const sessions: SessionSummary[] = [];
		for (const s of matching) {
			let firstMessage = s.meta.name || "";
			if (!firstMessage) {
				const prefix = yield* readTextPrefix(s.filePath, SESSION_TITLE_SCAN_BYTES).pipe(
					Effect.catchAll(() => Effect.succeed("")),
				);
				firstMessage = extractFirstUserMessage(prefix) || "";
				if (!firstMessage) {
					const fullText = yield* readFileText(s.filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
					firstMessage = extractFirstUserMessage(fullText) || "";
				}
				firstMessage ||= "Codex session";
			}

			const timestamp = epochSecondsToIso(s.meta.timestamps.created);

			sessions.push({
				sessionId: s.meta.uuid,
				timestamp: timestamp,
				slug: s.meta.uuid,
				firstMessage: firstMessage,
				model: s.meta.model || "unknown",
				gitBranch: "",
				pluginId: "codex-cli",
			});
		}

		sortByIsoDesc(sessions, (session) => session.timestamp);
		return sessions;
	});
}

export { discoverCodexProjects, listCodexSessions };
