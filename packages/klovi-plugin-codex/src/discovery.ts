import { readFile } from "node:fs/promises";
import type { PluginProject, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { epochSecondsToIso, sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { type SessionFileInfo, scanCodexSessions } from "./session-index.ts";
import { readTextPrefix } from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";

interface CodexEvent {
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
}

const SESSION_TITLE_SCAN_BYTES = 256 * 1024;

export async function discoverCodexProjects(): Promise<PluginProject[]> {
  const sessions = await scanCodexSessions();

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

  sortByIsoDesc(projects, (project) => project.lastActivity);
  return projects;
}

function extractFirstUserMessage(text: string): string | null {
  let message: string | null = null;

  iterateJsonl(
    text,
    ({ parsed }) => {
      const event = parsed as CodexEvent;

      // Old format: item.completed with agent_message
      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        event.item.text
      ) {
        message = event.item.text.slice(0, 200);
        return false;
      }

      // New format: event_msg with user_message payload
      if (event.type === "event_msg" && event.payload?.type === "user_message") {
        const text = event.payload.message || event.payload.text;
        if (typeof text === "string" && text) {
          message = text.slice(0, 200);
          return false;
        }
      }
      return;
    },
    { startAt: 1 },
  );

  return message;
}

export async function listCodexSessions(nativeId: string): Promise<SessionSummary[]> {
  const allSessions = await scanCodexSessions();
  const matching = allSessions.filter((s) => s.meta.cwd === nativeId);

  const sessions: SessionSummary[] = [];
  for (const s of matching) {
    let firstMessage = s.meta.name || "";
    if (!firstMessage) {
      const prefix = await readTextPrefix(s.filePath, SESSION_TITLE_SCAN_BYTES);
      firstMessage = extractFirstUserMessage(prefix) || "";
      if (!firstMessage) {
        const fullText = await readFile(s.filePath, "utf-8");
        firstMessage = extractFirstUserMessage(fullText) || "";
      }
      firstMessage ||= "Codex session";
    }

    const timestamp = epochSecondsToIso(s.meta.timestamps.created);

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

  sortByIsoDesc(sessions, (session) => session.timestamp);
  return sessions;
}
