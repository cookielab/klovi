import type { PluginProject, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { epochSecondsToIso, sortByIsoDesc, streamJsonlHead } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { type SessionFileInfo, scanCodexSessions } from "./session-index.ts";
import { readFileText } from "./shared/discovery-utils.ts";
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

function visitForFirstUserMessage(parsed: unknown, captured: { value: string | null }): boolean {
	const event = parsed as CodexEvent;
	if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
		const maxPreviewLength = 200;
		captured.value = event.item.text.slice(0, maxPreviewLength);
		return true;
	}
	if (event.type === "event_msg" && event.payload?.type === "user_message") {
		const payloadText = event.payload.message || event.payload.text;
		if (typeof payloadText === "string" && payloadText) {
			const maxMsgLength = 200;
			captured.value = payloadText.slice(0, maxMsgLength);
			return true;
		}
	}
	return false;
}

function streamFirstUserMessage(filePath: string) {
	return Effect.gen(function* () {
		const captured = { value: null as string | null };
		yield* streamJsonlHead(
			filePath,
			({ parsed, lineIndex }) => {
				if (lineIndex === 0) {
					// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
					return undefined;
				}
				if (visitForFirstUserMessage(parsed, captured)) {
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
				return undefined;
			},
			{ maxLines: 200 },
		).pipe(Effect.catchAll(() => Effect.void));
		return captured.value;
	});
}

function extractFirstUserMessageFromText(text: string): string | null {
	let message: string | null = null;

	iterateJsonl(
		text,
		({ parsed }) => {
			const event = parsed as CodexEvent;

			// Old format: item.completed with agent_message
			if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
				const maxPreviewLength = 200;
				message = event.item.text.slice(0, maxPreviewLength);
				return false;
			}

			// New format: event_msg with user_message payload
			if (event.type === "event_msg" && event.payload?.type === "user_message") {
				const payloadText = event.payload.message || event.payload.text;
				if (typeof payloadText === "string" && payloadText) {
					const maxMsgLength = 200;
					message = payloadText.slice(0, maxMsgLength);
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
			let firstMessage = s.meta.name ?? "";
			if (!firstMessage) {
				firstMessage = (yield* streamFirstUserMessage(s.filePath)) ?? "";
				if (!firstMessage) {
					const fullText = yield* readFileText(s.filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
					firstMessage = extractFirstUserMessageFromText(fullText) ?? "";
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
