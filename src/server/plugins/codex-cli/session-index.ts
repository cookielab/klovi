import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getCodexCliDir } from "../../config.ts";
import { readTextPrefix } from "../shared/discovery-utils.ts";

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

interface SessionIndexCache {
  sessionsDir: string;
  bySessionId: Map<string, string>;
}

let cache: SessionIndexCache | null = null;
const FIRST_LINE_SCAN_BYTES = 64 * 1024;

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

async function readFirstLine(filePath: string): Promise<string | null> {
  const text = await readTextPrefix(filePath, FIRST_LINE_SCAN_BYTES);
  const firstNewline = text.indexOf("\n");
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
  return firstLine.trim() ? firstLine : null;
}

async function parseSessionMeta(filePath: string): Promise<CodexSessionMeta | null> {
  const firstLine = await readFirstLine(filePath);
  if (!firstLine) return null;
  try {
    const parsed: unknown = JSON.parse(firstLine);
    if (isCodexSessionMeta(parsed)) return parsed;
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

function upsertCache(sessionsDir: string, sessionId: string, filePath: string): void {
  if (!cache || cache.sessionsDir !== sessionsDir) {
    cache = {
      sessionsDir,
      bySessionId: new Map([[sessionId, filePath]]),
    };
    return;
  }
  cache.bySessionId.set(sessionId, filePath);
}

export async function scanCodexSessions(): Promise<SessionFileInfo[]> {
  const sessionsDir = join(getCodexCliDir(), "sessions");
  const bySessionId = new Map<string, string>();
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
    bySessionId.set(meta.uuid, filePath);
  });

  cache = { sessionsDir, bySessionId };
  return sessions;
}

async function walkForFile(dir: string, targetFilename: string): Promise<string | null> {
  let entries: { name: string; isDirectory(): boolean }[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === targetFilename) return fullPath;
    if (entry.isDirectory()) {
      const found = await walkForFile(fullPath, targetFilename);
      if (found) return found;
    }
  }
  return null;
}

export async function findCodexSessionFileById(sessionId: string): Promise<string | null> {
  const sessionsDir = join(getCodexCliDir(), "sessions");

  if (cache?.sessionsDir === sessionsDir) {
    const cachedPath = cache.bySessionId.get(sessionId);
    if (cachedPath) {
      const fileStat = await stat(cachedPath).catch(() => null);
      if (fileStat?.isFile()) return cachedPath;
      cache.bySessionId.delete(sessionId);
    }
  }

  const filePath = await walkForFile(sessionsDir, `${sessionId}.jsonl`);
  if (filePath) upsertCache(sessionsDir, sessionId, filePath);
  return filePath;
}
