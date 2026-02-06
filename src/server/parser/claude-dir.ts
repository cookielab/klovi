import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Project, SessionSummary } from "../../shared/types.ts";
import type { RawLine } from "./types.ts";
import { cleanCommandMessage } from "./command-message.ts";

const CLAUDE_DIR = join(homedir(), ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");

export async function discoverProjects(): Promise<Project[]> {
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(PROJECTS_DIR, entry.name);
    const sessionFiles = (await readdir(projectDir)).filter((f) =>
      f.endsWith(".jsonl")
    );
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

export async function listSessions(
  encodedPath: string
): Promise<SessionSummary[]> {
  const projectDir = join(PROJECTS_DIR, encodedPath);
  const files = (await readdir(projectDir)).filter((f) => f.endsWith(".jsonl"));
  const sessions: SessionSummary[] = [];

  for (const file of files) {
    const filePath = join(projectDir, file);
    const sessionId = file.replace(".jsonl", "");
    const meta = await extractSessionMeta(filePath);
    if (meta) sessions.push({ sessionId, ...meta });
  }

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}

async function extractCwd(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split("\n");

  for (const line of lines.slice(0, 20)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);
      if (obj.cwd) return obj.cwd;
    } catch {
      continue;
    }
  }
  return "";
}

async function extractSessionMeta(
  filePath: string
): Promise<Omit<SessionSummary, "sessionId"> | null> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split("\n");

  let timestamp = "";
  let slug = "";
  let firstMessage = "";
  let model = "";
  let gitBranch = "";

  for (const line of lines.slice(0, 50)) {
    if (!line.trim()) continue;
    try {
      const obj: RawLine = JSON.parse(line);

      if (obj.timestamp && !timestamp) timestamp = obj.timestamp;
      if (obj.slug && !slug) slug = obj.slug;
      if (obj.gitBranch && !gitBranch) gitBranch = obj.gitBranch;

      if (obj.message?.model && !model) model = obj.message.model;

      // Find the first real user message
      if (
        !firstMessage &&
        obj.type === "user" &&
        !obj.isMeta &&
        obj.message
      ) {
        const content = obj.message.content;
        let raw = "";
        if (typeof content === "string") {
          raw = content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && "text" in block) {
              raw = block.text;
              break;
            }
          }
        }
        if (raw) {
          // Skip internal command messages
          if (
            raw.startsWith("<local-command") ||
            raw.startsWith("<command-name")
          ) {
            // skip
          } else {
            firstMessage = cleanCommandMessage(raw).slice(0, 200);
          }
        }
      }

      if (timestamp && slug && firstMessage && model && gitBranch) break;
    } catch {
      continue;
    }
  }

  if (!timestamp || !firstMessage) return null;

  return {
    timestamp,
    slug: slug || "unknown",
    firstMessage,
    model: model || "unknown",
    gitBranch: gitBranch || "",
  };
}

function decodeEncodedPath(encoded: string): string {
  // Encoded path has leading dash and dashes for slashes
  // e.g. "-Users-foo-Workspace-bar" -> "/Users/foo/Workspace/bar"
  if (encoded.startsWith("-")) {
    return "/" + encoded.slice(1).replace(/-/g, "/");
  }
  return encoded.replace(/-/g, "/");
}
