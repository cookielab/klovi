import type { ToolPlugin } from "../../shared/plugin-types.ts";
import { getClaudeCodeDir } from "../config.ts";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";
import { loadClaudeSession } from "./parser.ts";

export const claudeCodePlugin: ToolPlugin = {
  id: "claude-code",
  displayName: "Claude Code",
  getDefaultDataDir: () => getClaudeCodeDir(),
  discoverProjects: () => discoverClaudeProjects(),
  listSessions: (nativeId: string) => listClaudeSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) =>
    loadClaudeSession(nativeId, sessionId).then((r) => r.session),
  getResumeCommand: (sessionId: string) => `claude --resume ${sessionId}`,
};
