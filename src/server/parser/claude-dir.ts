import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { GlobalSessionResult, Project, SessionSummary } from "../../shared/types.ts";
import { getProjectsDir } from "../config.ts";
import { cleanCommandMessage } from "./command-message.ts";
import type { RawContentBlock, RawLine } from "./types.ts";

export async function discoverProjects(): Promise<Project[]> {
  const entries = await readdir(getProjectsDir(), { withFileTypes: true });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(getProjectsDir(), entry.name);
    const sessionFiles = (await readdir(projectDir)).filter((f) => f.endsWith(".jsonl"));
    if (sessionFiles.length === 0) continue;

    let lastActivity = "";
    let fullPath = "";

    // Read first session to get cwd for the real path
    for (const sf of sessionFiles) {
      const fileStat = await stat(join(projectDir, sf));
      const mtime = fileStat.mtime.toISOString();
      if (mtime > lastActivity) lastActivity = mtime;

      if (!fullPath) {
        fullPath = await extractCwd(join(projectDir, sf));
      }
    }

    // Decode the encoded path back to a readable name
    const name = fullPath || decodeEncodedPath(entry.name);

    projects.push({
      encodedPath: entry.name,
      name,
      fullPath: fullPath || decodeEncodedPath(entry.name),
      sessionCount: sessionFiles.length,
      lastActivity,
    });
  }

  projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return projects;
}

const PLAN_PREFIX = "Implement the following plan";

export async function listSessions(encodedPath: string): Promise<SessionSummary[]> {
  const projectDir = join(getProjectsDir(), encodedPath);
  const files = (await readdir(projectDir)).filter((f) => f.endsWith(".jsonl"));
  const sessions: SessionSummary[] = [];

  for (const file of files) {
    const filePath = join(projectDir, file);
    const sessionId = file.replace(".jsonl", "");
    const meta = await extractSessionMeta(filePath);
    if (meta) sessions.push({ sessionId, ...meta });
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

async function extractCwd(filePath: string): Promise<string> {
  const text = await readFile(filePath, "utf-8");
  const lines = text.split("\n");

  for (const line of lines.slice(0, 20)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);
      if (obj.cwd) return obj.cwd;
    } catch {
      // Malformed lines skipped here; full errors reported by parseSession()
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

async function extractSessionMeta(
  filePath: string,
): Promise<Omit<SessionSummary, "sessionId"> | null> {
  const text = await readFile(filePath, "utf-8");
  const lines = text.split("\n");

  const meta: MetaFields = { timestamp: "", slug: "", firstMessage: "", model: "", gitBranch: "" };

  for (const line of lines.slice(0, 50)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);
      processMetaLine(obj, meta);
      if (isMetaComplete(meta)) break;
    } catch {
      // Malformed lines skipped here; full errors reported by parseSession()
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

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export function aggregateSessions(
  projects: Project[],
  sessionsByProject: Map<string, SessionSummary[]>,
): GlobalSessionResult[] {
  const results: GlobalSessionResult[] = [];

  for (const project of projects) {
    const sessions = sessionsByProject.get(project.encodedPath) ?? [];
    const projectName = projectNameFromPath(project.name);

    for (const session of sessions) {
      results.push({
        ...session,
        encodedPath: project.encodedPath,
        projectName,
      });
    }
  }

  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return results;
}

export async function listAllSessions(): Promise<GlobalSessionResult[]> {
  const projects = await discoverProjects();
  const sessionsByProject = new Map<string, SessionSummary[]>();

  for (const project of projects) {
    const sessions = await listSessions(project.encodedPath);
    sessionsByProject.set(project.encodedPath, sessions);
  }

  return aggregateSessions(projects, sessionsByProject);
}

function decodeEncodedPath(encoded: string): string {
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
