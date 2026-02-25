import type { ToolPlugin } from "../../shared/plugin-types.ts";
import { getClaudeCodeDir } from "../config.ts";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "./parser.ts";

export const claudeCodePlugin: ToolPlugin = {
  id: "claude-code",
  displayName: "Claude Code",
  getDefaultDataDir: () => getClaudeCodeDir(),
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
