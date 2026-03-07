import { join } from "node:path";
import {
  PluginConfig,
  type PluginProject,
  type SessionSummary,
  sortByIsoDesc,
} from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { cleanCommandMessage } from "./command-message.ts";
import type { RawContentBlock, RawLine } from "./raw-types.ts";
import {
  decodeEncodedPath,
  listFilesBySuffix,
  listFilesWithMtime,
  readDirEntriesSafe,
  readTextPrefix,
} from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";

const CWD_SCAN_BYTES = 64 * 1024;
const SESSION_META_SCAN_BYTES = 1024 * 1024;
const BRACKETED_TEXT_REGEX = /^\[.+\]$/;

function inspectProjectSessions(
  projectDir: string,
  sessionFiles: { fileName: string; mtime: string }[],
) {
  return Effect.gen(function* () {
    const lastActivity = sessionFiles[0]?.mtime || "";
    let resolvedPath = "";

    for (const sessionFile of sessionFiles) {
      const filePath = join(projectDir, sessionFile.fileName);
      if (!resolvedPath) {
        resolvedPath = yield* extractCwd(filePath);
      }
    }

    return { lastActivity, resolvedPath };
  });
}

export function discoverClaudeProjects() {
  return Effect.gen(function* () {
    const config = yield* PluginConfig;
    const projectsDir = join(config.dataDir, "projects");
    const entries = yield* readDirEntriesSafe(projectsDir);
    const projects: PluginProject[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory) continue;

      const projectDir = join(projectsDir, entry.name);
      const sessionFiles = yield* listFilesWithMtime(projectDir, ".jsonl");
      if (sessionFiles.length === 0) continue;

      const projectInfo = yield* inspectProjectSessions(projectDir, sessionFiles);
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

    sortByIsoDesc(projects, (project) => project.lastActivity);
    return projects;
  });
}

const PLAN_PREFIX = "Implement the following plan";

export function listClaudeSessions(nativeId: string) {
  return Effect.gen(function* () {
    const config = yield* PluginConfig;
    const projectDir = join(config.dataDir, "projects", nativeId);
    const files = yield* listFilesBySuffix(projectDir, ".jsonl");
    const sessions: SessionSummary[] = [];

    for (const file of files) {
      const filePath = join(projectDir, file);
      const sessionId = file.replace(".jsonl", "");
      const meta = yield* extractSessionMeta(filePath);
      if (meta) sessions.push({ sessionId, pluginId: "claude-code", ...meta });
    }

    classifySessionTypes(sessions);

    sortByIsoDesc(sessions, (session) => session.timestamp);
    return sessions;
  });
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

export function extractCwd(filePath: string) {
  return Effect.gen(function* () {
    const text = yield* readTextPrefix(filePath, CWD_SCAN_BYTES).pipe(
      Effect.catchAll(() => Effect.succeed("")),
    );
    if (!text) return "";

    let cwd = "";

    iterateJsonl(
      text,
      ({ parsed }) => {
        const obj = parsed as RawLine;
        if (obj.cwd) {
          cwd = obj.cwd;
          return false;
        }
        return;
      },
      { maxLines: 20 },
    );

    return cwd;
  });
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
    BRACKETED_TEXT_REGEX.test(text.trim())
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

export function extractSessionMeta(filePath: string) {
  return Effect.gen(function* () {
    const text = yield* readTextPrefix(filePath, SESSION_META_SCAN_BYTES).pipe(
      Effect.catchAll(() => Effect.succeed("")),
    );
    if (!text) return null;

    const meta: MetaFields = {
      timestamp: "",
      slug: "",
      firstMessage: "",
      model: "",
      gitBranch: "",
    };

    iterateJsonl(
      text,
      ({ parsed }) => {
        const obj = parsed as RawLine;
        processMetaLine(obj, meta);
        if (isMetaComplete(meta)) return false;
        return;
      },
      {
        maxLines: 50,
        onMalformed: () => {
          // Malformed lines skipped here; full errors reported by loadClaudeSession()
        },
      },
    );

    if (!meta.timestamp || !meta.firstMessage) return null;

    return {
      timestamp: meta.timestamp,
      slug: meta.slug || "unknown",
      firstMessage: meta.firstMessage,
      model: meta.model || "unknown",
      gitBranch: meta.gitBranch || "",
    } as Omit<SessionSummary, "sessionId">;
  });
}
