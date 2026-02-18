import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PluginProject } from "../../../shared/plugin-types.ts";
import type { SessionSummary } from "../../../shared/types.ts";
import { getProjectsDir } from "../../config.ts";
import { cleanCommandMessage } from "../../parser/command-message.ts";
import type { RawContentBlock, RawLine } from "../../parser/types.ts";

async function readDirEntriesSafe(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter((file) => file.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

async function inspectProjectSessions(
  projectDir: string,
  sessionFiles: string[],
): Promise<{ lastActivity: string; resolvedPath: string }> {
  let lastActivity = "";
  let resolvedPath = "";

  for (const sessionFile of sessionFiles) {
    const filePath = join(projectDir, sessionFile);
    const fileStat = await stat(filePath).catch(() => null);
    const mtime = fileStat?.mtime.toISOString();
    if (mtime && mtime > lastActivity) lastActivity = mtime;

    if (!resolvedPath) {
      resolvedPath = await extractCwd(filePath);
    }
  }

  return { lastActivity, resolvedPath };
}

export async function discoverClaudeProjects(): Promise<PluginProject[]> {
  const projectsDir = getProjectsDir();
  const entries = await readDirEntriesSafe(projectsDir);
  const projects: PluginProject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(projectsDir, entry.name);
    const sessionFiles = await listJsonlFiles(projectDir);
    if (sessionFiles.length === 0) continue;

    const projectInfo = await inspectProjectSessions(projectDir, sessionFiles);
    const resolvedPath = projectInfo.resolvedPath || decodeEncodedPath(entry.name);

    projects.push({
      pluginId: "claude-code",
      nativeId: entry.name,
      resolvedPath,
      displayName: resolvedPath,
      sessionCount: sessionFiles.length,
      lastActivity: projectInfo.lastActivity,
    });
  }

  projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return projects;
}

const PLAN_PREFIX = "Implement the following plan";

export async function listClaudeSessions(nativeId: string): Promise<SessionSummary[]> {
  const projectDir = join(getProjectsDir(), nativeId);
  const files = await listJsonlFiles(projectDir);
  const sessions: SessionSummary[] = [];

  for (const file of files) {
    const filePath = join(projectDir, file);
    const sessionId = file.replace(".jsonl", "");
    const meta = await extractSessionMeta(filePath);
    if (meta) sessions.push({ sessionId, pluginId: "claude-code", ...meta });
  }

  classifySessionTypes(sessions);

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}

export function classifySessionTypes(sessions: SessionSummary[]): void {
  // First pass: mark implementation sessions
  const implSlugs = new Set<string>();
  for (const session of sessions) {
    if (session.firstMessage.startsWith(PLAN_PREFIX)) {
      session.sessionType = "implementation";
      if (session.slug) implSlugs.add(session.slug);
    }
  }

  // Second pass: mark plan sessions (same slug as an implementation session, but not itself one)
  for (const session of sessions) {
    if (!session.sessionType && session.slug && implSlugs.has(session.slug)) {
      session.sessionType = "plan";
    }
  }
}

export async function extractCwd(filePath: string): Promise<string> {
  let text = "";
  try {
    text = await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
  const lines = text.split("\n");

  for (const line of lines.slice(0, 20)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);
      if (obj.cwd) return obj.cwd;
    } catch {
      // Malformed lines skipped here; full errors reported by loadClaudeSession()
    }
  }
  return "";
}

interface MetaFields {
  timestamp: string;
  slug: string;
  firstMessage: string;
  model: string;
  gitBranch: string;
}

function extractTextFromContent(content: string | RawContentBlock[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text" && "text" in block) return block.text;
    }
  }
  return "";
}

function isInternalMessage(text: string): boolean {
  return (
    text.startsWith("<local-command") ||
    text.startsWith("<command-name") ||
    /^\[.+\]$/.test(text.trim())
  );
}

function isMetaComplete(meta: MetaFields): boolean {
  return !!(meta.timestamp && meta.slug && meta.firstMessage && meta.model && meta.gitBranch);
}

function processMetaLine(obj: RawLine, meta: MetaFields): void {
  if (obj.timestamp && !meta.timestamp) meta.timestamp = obj.timestamp;
  if (obj.slug && !meta.slug) meta.slug = obj.slug;
  if (obj.gitBranch && !meta.gitBranch) meta.gitBranch = obj.gitBranch;
  if (obj.message?.model && !meta.model) meta.model = obj.message.model;

  if (!meta.firstMessage && obj.type === "user" && !obj.isMeta && obj.message) {
    const raw = extractTextFromContent(obj.message.content);
    if (raw && !isInternalMessage(raw)) {
      meta.firstMessage = cleanCommandMessage(raw).slice(0, 200);
    }
  }
}

export async function extractSessionMeta(
  filePath: string,
): Promise<Omit<SessionSummary, "sessionId"> | null> {
  let text = "";
  try {
    text = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
  const lines = text.split("\n");

  const meta: MetaFields = { timestamp: "", slug: "", firstMessage: "", model: "", gitBranch: "" };

  for (const line of lines.slice(0, 50)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);
      processMetaLine(obj, meta);
      if (isMetaComplete(meta)) break;
    } catch {
      // Malformed lines skipped here; full errors reported by loadClaudeSession()
    }
  }

  if (!meta.timestamp || !meta.firstMessage) return null;

  return {
    timestamp: meta.timestamp,
    slug: meta.slug || "unknown",
    firstMessage: meta.firstMessage,
    model: meta.model || "unknown",
    gitBranch: meta.gitBranch || "",
  };
}
export function decodeEncodedPath(encoded: string): string {
  // Encoded path has leading dash and dashes for slashes
  // e.g. "-Users-foo-Workspace-bar" -> "/Users/foo/Workspace/bar"
  // Windows: "-C-Users-foo-bar" -> "C:/Users/foo/bar"
  if (encoded.startsWith("-")) {
    const withSlashes = encoded.slice(1).replace(/-/g, "/");
    // On Windows, detect single-letter drive prefix (e.g. "C/Users/...")
    if (process.platform === "win32" && /^[A-Za-z]\//.test(withSlashes)) {
      return `${withSlashes[0]}:${withSlashes.slice(1)}`;
    }
    return `/${withSlashes}`;
  }
  return encoded.replace(/-/g, "/");
}
