import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PluginProject } from "../../../shared/plugin-types.ts";
import type { SessionSummary } from "../../../shared/types.ts";
import { getCodexCliDir } from "../../config.ts";

interface CodexSessionMeta {
  uuid: string;
  name?: string;
  cwd: string;
  timestamps: { created: number; updated: number };
  model: string;
  provider_id: string;
}

interface CodexEvent {
  type: string;
  item?: {
    type?: string;
    text?: string;
  };
}

function isSessionMeta(obj: unknown): obj is CodexSessionMeta {
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

async function readFirstLine(filePath: string): Promise<CodexSessionMeta | null> {
  const text = await readFile(filePath, "utf-8");
  const firstNewline = text.indexOf("\n");
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
  if (!firstLine.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(firstLine);
    if (isSessionMeta(parsed)) return parsed;
  } catch {
    // Malformed first line
  }
  return null;
}

async function findAllJsonlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let names: string[];
    try {
      names = await readdir(current);
    } catch {
      return;
    }
    for (const name of names) {
      const fullPath = join(current, name);
      const s = await stat(fullPath).catch(() => null);
      if (!s) continue;
      if (s.isDirectory()) {
        await walk(fullPath);
      } else if (name.endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

interface SessionFileInfo {
  filePath: string;
  meta: CodexSessionMeta;
  mtime: string;
}

async function scanAllSessions(): Promise<SessionFileInfo[]> {
  const sessionsDir = join(getCodexCliDir(), "sessions");
  const files = await findAllJsonlFiles(sessionsDir);
  const results: SessionFileInfo[] = [];

  for (const filePath of files) {
    const meta = await readFirstLine(filePath);
    if (!meta) continue;
    const fileStat = await stat(filePath);
    results.push({
      filePath,
      meta,
      mtime: fileStat.mtime.toISOString(),
    });
  }

  return results;
}

export async function discoverCodexProjects(): Promise<PluginProject[]> {
  const sessions = await scanAllSessions();

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
      if (s.mtime > lastActivity) lastActivity = s.mtime;
    }

    projects.push({
      pluginId: "codex-cli",
      nativeId: cwd,
      resolvedPath: cwd,
      displayName: cwd,
      sessionCount: cwdSessions.length,
      lastActivity,
    });
  }

  projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return projects;
}

function extractFirstUserMessage(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as CodexEvent;
      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        event.item.text
      ) {
        return event.item.text.slice(0, 200);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return null;
}

export async function listCodexSessions(nativeId: string): Promise<SessionSummary[]> {
  const allSessions = await scanAllSessions();
  const matching = allSessions.filter((s) => s.meta.cwd === nativeId);

  const sessions: SessionSummary[] = [];
  for (const s of matching) {
    let firstMessage = s.meta.name || "";
    if (!firstMessage) {
      const text = await readFile(s.filePath, "utf-8");
      firstMessage = extractFirstUserMessage(text) || "Codex session";
    }

    const timestamp = new Date(s.meta.timestamps.created * 1000).toISOString();

    sessions.push({
      sessionId: s.meta.uuid,
      timestamp,
      slug: s.meta.uuid,
      firstMessage,
      model: s.meta.model || "unknown",
      gitBranch: "",
      pluginId: "codex-cli",
    });
  }

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}
