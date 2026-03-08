import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, PluginError } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "./parser.ts";
import { fileExists } from "./shared/discovery-utils.ts";

export const claudeCodePlugin: ToolPlugin<string, SessionSummary, Session> = {
  id: "claude-code",
  displayName: "Claude Code",
  getDefaultDataDir: () => null,
  isDataAvailable: Effect.gen(function* () {
    const config = yield* PluginConfig;
    return yield* fileExists(config.dataDir).pipe(Effect.catchAll(() => Effect.succeed(false)));
  }),
  discoverProjects: discoverClaudeProjects(),
  listSessions: (nativeId: string) => listClaudeSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) =>
    loadClaudeSession(nativeId, sessionId).pipe(
      Effect.map((r) => r.session),
      Effect.catchAll((err) =>
        Effect.fail(
          new PluginError({
            pluginId: "claude-code",
            operation: "loadSession",
            message: String(err),
            cause: err,
          }),
        ),
      ),
    ),
  loadSessionDetail: (nativeId: string, sessionId: string) =>
    Effect.gen(function* () {
      const [{ session, slug }, sessions] = yield* Effect.all([
        loadClaudeSession(nativeId, sessionId),
        listClaudeSessions(nativeId),
      ]);

      return {
        session,
        planSessionId: findPlanSessionId(session.turns, slug, sessions, sessionId),
        implSessionId: findImplSessionId(slug, sessions, sessionId),
      };
    }).pipe(
      Effect.catchAll((err) =>
        Effect.fail(
          new PluginError({
            pluginId: "claude-code",
            operation: "loadSessionDetail",
            message: String(err),
            cause: err,
          }),
        ),
      ),
    ),
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
