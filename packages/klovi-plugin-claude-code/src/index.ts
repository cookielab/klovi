import { existsSync } from "node:fs";
import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { getClaudeCodeDir } from "./config.ts";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "./parser.ts";

export const claudeCodePlugin: ToolPlugin<string, SessionSummary, Session> = {
  id: "claude-code",
  displayName: "Claude Code",
  getDefaultDataDir: () => getClaudeCodeDir(),
  isDataAvailable: () => existsSync(getClaudeCodeDir()),
  discoverProjects: () => discoverClaudeProjects(),
  listSessions: (nativeId: string) => listClaudeSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) =>
    loadClaudeSession(nativeId, sessionId).then((r) => r.session),
  loadSessionDetail: async (nativeId: string, sessionId: string) => {
    const [{ session, slug }, sessions] = await Promise.all([
      loadClaudeSession(nativeId, sessionId),
      listClaudeSessions(nativeId),
    ]);

    return {
      session,
      planSessionId: findPlanSessionId(session.turns, slug, sessions, sessionId),
      implSessionId: findImplSessionId(slug, sessions, sessionId),
    };
  },
  loadSubAgentSession: (params) =>
    parseSubAgentSession(params.sessionId, params.project, params.agentId),
  getResumeCommand: (sessionId: string) => `claude --resume ${sessionId}`,
};

export { cleanCommandMessage, parseCommandMessage } from "./command-message.ts";
export {
  DEFAULT_CLAUDE_CODE_DIR,
  getClaudeCodeDir,
  getProjectsDir,
  setClaudeCodeDir,
} from "./config.ts";
export {
  classifySessionTypes,
  discoverClaudeProjects,
  extractCwd,
  extractSessionMeta,
  listClaudeSessions,
} from "./discovery.ts";
export { claudeCodeFrontendPlugin } from "./frontend.ts";
export {
  buildTurns,
  extractSlug,
  extractSubAgentMap,
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "./parser.ts";
export type { RawContentBlock, RawLine, RawToolResultBlock } from "./raw-types.ts";
