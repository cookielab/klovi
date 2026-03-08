import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { readTextPrefix } from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";

export interface CodexSessionMeta {
  uuid: string;
  name?: string;
  cwd: string;
  timestamps: { created: number; updated: number };
  model: string;
  provider_id: string;
}

export interface SessionFileInfo {
  filePath: string;
  meta: CodexSessionMeta;
  mtime: string;
}

const FIRST_LINE_SCAN_BYTES = 512 * 1024;

export function isCodexSessionMeta(obj: unknown): obj is CodexSessionMeta {
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

interface NewFormatMeta {
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
}

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

export function normalizeSessionMeta(
  parsed: unknown,
  fileMtimeEpoch?: number,
): CodexSessionMeta | null {
  if (isCodexSessionMeta(parsed)) return parsed;

  if (isNewFormatMeta(parsed)) {
    const { payload } = parsed;
    const isoTimestamp = payload.timestamp || parsed.timestamp;
    const createdEpoch = isoTimestamp ? new Date(isoTimestamp).getTime() / 1000 : 0;
    const updatedEpoch = fileMtimeEpoch ?? createdEpoch;

    return {
      uuid: payload.id,
      cwd: payload.cwd,
      timestamps: { created: createdEpoch, updated: updatedEpoch },
      model: payload.model || "unknown",
      provider_id: payload.model_provider || "unknown",
    };
  }

  return null;
}

function isKnownModel(model: string | null | undefined): model is string {
  return typeof model === "string" && model.length > 0 && model !== "unknown";
}

function extractTurnContextModel(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const event = parsed as { type?: unknown; payload?: { model?: unknown } };
  if (event.type !== "turn_context") return null;
  return typeof event.payload?.model === "string" ? event.payload.model : null;
}

function inferModelFromPrefix(prefixText: string): string | null {
  let model: string | null = null;
  iterateJsonl(
    prefixText,
    ({ parsed }) => {
      const extracted = extractTurnContextModel(parsed);
      if (isKnownModel(extracted)) {
        model = extracted;
        return false;
      }
      return;
    },
    { startAt: 1, maxLines: 256 },
  );
  return model;
}

function parseSessionMeta(filePath: string, fileMtimeEpoch: number | undefined) {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Effect.gen wrapper adds nesting
  return Effect.gen(function* () {
    const prefix = yield* readTextPrefix(filePath, FIRST_LINE_SCAN_BYTES).pipe(
      Effect.catchAll(() => Effect.succeed("")),
    );
    if (!prefix) return null;

    const firstNewline = prefix.indexOf("\n");
    const firstLine = firstNewline === -1 ? prefix : prefix.slice(0, firstNewline);
    const trimmedFirstLine = firstLine.trim();
    if (!trimmedFirstLine) return null;
    try {
      const parsed: unknown = JSON.parse(trimmedFirstLine);
      const meta = normalizeSessionMeta(parsed, fileMtimeEpoch);
      if (!meta) return null;
      if (isKnownModel(meta.model)) return meta;

      const inferred = inferModelFromPrefix(prefix);
      if (isKnownModel(inferred)) return { ...meta, model: inferred };
      if (isKnownModel(meta.provider_id)) return { ...meta, model: meta.provider_id };
      return meta;
    } catch {
      // Malformed first line
    }
    return null;
  });
}

function walkJsonlFiles(
  dir: string,
  visit: (filePath: string, fileName: string) => Effect.Effect<void, never, FileSystem.FileSystem>,
): Effect.Effect<void, never, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs
      .readDirectory(dir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));

    for (const name of names) {
      const fullPath = join(dir, name);
      const info = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
      if (!info) continue;

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

export function scanCodexSessions() {
  return Effect.gen(function* () {
    const config = yield* PluginConfig;
    const fs = yield* FileSystem.FileSystem;
    const sessionsDir = join(config.dataDir, "sessions");
    const sessions: SessionFileInfo[] = [];

    yield* walkJsonlFiles(sessionsDir, (filePath, _fileName) =>
      Effect.gen(function* () {
        const info = yield* fs.stat(filePath).pipe(Effect.catchAll(() => Effect.succeed(null)));
        const fileMtimeEpoch =
          info?.mtime._tag === "Some" ? info.mtime.value.getTime() / 1000 : undefined;

        const meta = yield* parseSessionMeta(filePath, fileMtimeEpoch);
        if (!meta) return;

        if (info?.mtime._tag === "Some") {
          sessions.push({
            filePath,
            meta,
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Effect.gen wrapper adds nesting
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs
      .readDirectory(dir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));

    for (const name of names) {
      const fullPath = join(dir, name);
      const info = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
      if (!info) continue;

      if (info.type !== "Directory" && match(name)) return fullPath;
      if (info.type === "Directory") {
        const found = yield* walkForFile(fullPath, match);
        if (found) return found;
      }
    }
    return null;
  });
}

export function findCodexSessionFileById(sessionId: string) {
  return Effect.gen(function* () {
    const config = yield* PluginConfig;
    const fs = yield* FileSystem.FileSystem;
    const sessionsDir = join(config.dataDir, "sessions");
    const exactName = `${sessionId}.jsonl`;
    const suffix = `-${sessionId}.jsonl`;

    const filePath = yield* walkForFile(
      sessionsDir,
      (name) => name === exactName || name.endsWith(suffix),
    );
    if (!filePath) return null;

    const info = yield* fs.stat(filePath).pipe(Effect.catchAll(() => Effect.succeed(null)));
    return info?.type === "File" ? filePath : null;
  });
}
