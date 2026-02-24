import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getCodexCliDir } from "../config.ts";
import { readTextPrefix } from "../shared/discovery-utils.ts";
import { iterateJsonl } from "../shared/jsonl-utils.ts";

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
    },
    { startAt: 1, maxLines: 256 },
  );
  return model;
}

async function parseSessionMeta(filePath: string): Promise<CodexSessionMeta | null> {
  const prefix = await readTextPrefix(filePath, FIRST_LINE_SCAN_BYTES);
  const firstNewline = prefix.indexOf("\n");
  const firstLine = firstNewline === -1 ? prefix : prefix.slice(0, firstNewline);
  const trimmedFirstLine = firstLine.trim();
  if (!trimmedFirstLine) return null;
  try {
    const parsed: unknown = JSON.parse(trimmedFirstLine);
    const fileStat = await stat(filePath).catch(() => null);
    const fileMtimeEpoch = fileStat ? fileStat.mtime.getTime() / 1000 : undefined;
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
}

async function walkJsonlFiles(
  dir: string,
  visit: (filePath: string, fileName: string) => Promise<void>,
): Promise<void> {
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkJsonlFiles(fullPath, visit);
      continue;
    }
    if (entry.name.endsWith(".jsonl")) {
      await visit(fullPath, entry.name);
    }
  }
}

export async function scanCodexSessions(): Promise<SessionFileInfo[]> {
  const sessionsDir = join(getCodexCliDir(), "sessions");
  const sessions: SessionFileInfo[] = [];

  await walkJsonlFiles(sessionsDir, async (filePath) => {
    const meta = await parseSessionMeta(filePath);
    if (!meta) return;

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) return;

    sessions.push({
      filePath,
      meta,
      mtime: fileStat.mtime.toISOString(),
    });
  });

  return sessions;
}

async function walkForFile(
  dir: string,
  match: (fileName: string) => boolean,
): Promise<string | null> {
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (!entry.isDirectory() && match(entry.name)) return fullPath;
    if (entry.isDirectory()) {
      const found = await walkForFile(fullPath, match);
      if (found) return found;
    }
  }
  return null;
}

export async function findCodexSessionFileById(sessionId: string): Promise<string | null> {
  const sessionsDir = join(getCodexCliDir(), "sessions");
  const exactName = `${sessionId}.jsonl`;
  const suffix = `-${sessionId}.jsonl`;

  const filePath = await walkForFile(
    sessionsDir,
    (name) => name === exactName || name.endsWith(suffix),
  );
  if (!filePath) return null;

  const fileStat = await stat(filePath).catch(() => null);
  return fileStat?.isFile() ? filePath : null;
}
