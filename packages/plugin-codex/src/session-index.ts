import { join } from "node:path";
import { PluginConfig, streamJsonlHead } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";


const N_256 = 256;

type CodexSessionMeta = {
	uuid: string;
	name?: string;
	cwd: string;
	timestamps: { created: number; updated: number };
	model: string;
	provider_id: string;
};

type SessionFileInfo = {
	filePath: string;
	meta: CodexSessionMeta;
	mtime: string;
};

const MS_PER_SECOND = 1000;

function isCodexSessionMeta(obj: unknown): obj is CodexSessionMeta {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"uuid" in obj &&
		"cwd" in obj &&
		"timestamps" in obj &&
		typeof (obj as CodexSessionMeta).uuid === "string" &&
		typeof (obj as CodexSessionMeta).cwd === "string"
	);
}

type NewFormatMeta = {
	type: "session_meta";
	timestamp?: string;
	payload: {
		id: string;
		cwd: string;
		timestamp?: string;
		model_provider?: string;
		model?: string;
		originator?: string;
		[key: string]: unknown;
	};
};

function isNewFormatMeta(obj: unknown): obj is NewFormatMeta {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		(obj as NewFormatMeta).type === "session_meta" &&
		"payload" in obj &&
		typeof (obj as NewFormatMeta).payload === "object" &&
		(obj as NewFormatMeta).payload !== null &&
		typeof (obj as NewFormatMeta).payload.id === "string" &&
		typeof (obj as NewFormatMeta).payload.cwd === "string"
	);
}

function normalizeSessionMeta(parsed: unknown, fileMtimeEpoch?: number): CodexSessionMeta | null {
	if (isCodexSessionMeta(parsed)) {
		return parsed;
	}

	if (isNewFormatMeta(parsed)) {
		const { payload } = parsed;
		const isoTimestamp = payload.timestamp || parsed.timestamp;
		const createdEpoch = isoTimestamp ? new Date(isoTimestamp).getTime() / MS_PER_SECOND : 0;
		const updatedEpoch = fileMtimeEpoch ?? createdEpoch;

		return {
			uuid: payload.id,
			cwd: payload.cwd,
			timestamps: { created: createdEpoch, updated: updatedEpoch },
			model: payload.model || "unknown",
			["provider_id"]: payload.model_provider || "unknown",
		};
	}

	return null;
}

function isKnownModel(model: string | null | undefined): model is string {
	return typeof model === "string" && model.length > 0 && model !== "unknown";
}

function extractTurnContextModel(parsed: unknown): string | null {
	if (typeof parsed !== "object" || parsed === null) {
		return null;
	}
	const event = parsed as { type?: unknown; payload?: { model?: unknown } };
	if (event.type !== "turn_context") {
		return null;
	}
	return typeof event.payload?.model === "string" ? event.payload.model : null;
}

function streamInferredModel(filePath: string) {
	return Effect.gen(function* () {
		let model: string | null = null;
		yield* streamJsonlHead(
			filePath,
			({ parsed, lineIndex }) => {
				if (lineIndex === 0) {
					return undefined;
				}
				const extracted = extractTurnContextModel(parsed);
				if (isKnownModel(extracted)) {
					model = extracted;
					return false;
				}
				return undefined;
			},
			{ maxLines: N_256 },
		).pipe(Effect.catchAll(() => Effect.void));
		return model;
	});
}

function parseSessionMeta(filePath: string, fileMtimeEpoch: number | undefined) {
	return Effect.gen(function* () {
		// Object wrapper avoids TS narrowing the closure-assigned `null` after the stream
		// completes — direct `let firstLineMeta: CodexSessionMeta | null = null` followed by
		// `if (!firstLineMeta) ... firstLineMeta.model` would not narrow inside the visitor.
		const captured = { value: null as CodexSessionMeta | null };
		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				captured.value = normalizeSessionMeta(parsed, fileMtimeEpoch);
				return false;
			},
			{ maxLines: 1 },
		).pipe(Effect.catchAll(() => Effect.void));

		const firstLineMeta = captured.value;
		if (!firstLineMeta) {
			return null;
		}
		if (isKnownModel(firstLineMeta.model)) {
			return firstLineMeta;
		}

		const inferred = yield* streamInferredModel(filePath);
		if (isKnownModel(inferred)) {
			return { ...firstLineMeta, model: inferred };
		}
		if (isKnownModel(firstLineMeta.provider_id)) {
			return { ...firstLineMeta, model: firstLineMeta.provider_id };
		}
		return firstLineMeta;
	});
}

function walkJsonlFiles(
	dir: string,
	visit: (filePath: string, fileName: string) => Effect.Effect<void, never, FileSystem.FileSystem>,
): Effect.Effect<void, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));

		for (const name of names) {
			const fullPath = join(dir, name);
			const info = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (!info) {
				continue;
			}

			if (info.type === "Directory") {
				yield* walkJsonlFiles(fullPath, visit);
				continue;
			}
			if (name.endsWith(".jsonl")) {
				yield* visit(fullPath, name);
			}
		}
	});
}

function scanCodexSessions() {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const fs = yield* FileSystem.FileSystem;
		const sessionsDir = join(config.dataDir, "sessions");
		const sessions: SessionFileInfo[] = [];

		yield* walkJsonlFiles(sessionsDir, (filePath, _fileName) =>
			Effect.gen(function* () {
				const info = yield* fs.stat(filePath).pipe(Effect.catchAll(() => Effect.succeed(null)));
				const fileMtimeEpoch = info?.mtime._tag === "Some" ? info.mtime.value.getTime() / MS_PER_SECOND : undefined;

				const meta = yield* parseSessionMeta(filePath, fileMtimeEpoch);
				if (!meta) {
					return;
				}

				if (info?.mtime._tag === "Some") {
					sessions.push({
						filePath: filePath,
						meta: meta,
						mtime: info.mtime.value.toISOString(),
					});
				}
			}),
		);

		return sessions;
	});
}

function walkForFile(
	dir: string,
	match: (fileName: string) => boolean,
): Effect.Effect<string | null, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));

		for (const name of names) {
			const fullPath = join(dir, name);
			const info = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (!info) {
				continue;
			}

			if (info.type !== "Directory" && match(name)) {
				return fullPath;
			}
			if (info.type === "Directory") {
				const found = yield* walkForFile(fullPath, match);
				if (found) {
					return found;
				}
			}
		}
		return null;
	});
}

function findCodexSessionFileById(sessionId: string) {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const fs = yield* FileSystem.FileSystem;
		const sessionsDir = join(config.dataDir, "sessions");
		const exactName = `${sessionId}.jsonl`;
		const suffix = `-${sessionId}.jsonl`;

		const filePath = yield* walkForFile(sessionsDir, (name) => name === exactName || name.endsWith(suffix));
		if (!filePath) {
			return null;
		}

		const info = yield* fs.stat(filePath).pipe(Effect.catchAll(() => Effect.succeed(null)));
		return info?.type === "File" ? filePath : null;
	});
}

export type { CodexSessionMeta, SessionFileInfo };
export { findCodexSessionFileById, isCodexSessionMeta, normalizeSessionMeta, scanCodexSessions };
