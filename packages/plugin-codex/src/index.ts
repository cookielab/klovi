import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, PluginError } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { discoverCodexProjects, listCodexSessions } from "./discovery.ts";
import { loadCodexSession } from "./parser.ts";
import { fileExists } from "./shared/discovery-utils.ts";

export const codexCliPlugin: ToolPlugin<string, SessionSummary, Session> = {
  id: "codex-cli",
  displayName: "Codex",
  getDefaultDataDir: () => null,
  isDataAvailable: Effect.gen(function* () {
    const config = yield* PluginConfig;
    return yield* fileExists(config.dataDir).pipe(Effect.catchAll(() => Effect.succeed(false)));
  }),
  discoverProjects: discoverCodexProjects(),
  listSessions: (nativeId: string) => listCodexSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) =>
    loadCodexSession(nativeId, sessionId).pipe(
      Effect.catchAll((err) =>
        Effect.fail(
          new PluginError({
            pluginId: "codex-cli",
            operation: "loadSession",
            message: String(err),
            cause: err,
          }),
        ),
      ),
    ),
  getResumeCommand: (sessionId: string) => `codex resume ${sessionId}`,
};

export { DEFAULT_CODEX_CLI_DIR, getCodexCliDir, setCodexCliDir } from "./config.ts";
export { discoverCodexProjects, listCodexSessions } from "./discovery.ts";
export { codexInputFormatters, codexSummaryExtractors } from "./extractors.ts";
export { codexFrontendPlugin } from "./frontend.ts";
export type { CodexEvent } from "./parser.ts";
export { buildCodexTurns, loadCodexSession } from "./parser.ts";
export type { CodexSessionMeta, SessionFileInfo } from "./session-index.ts";
export {
  findCodexSessionFileById,
  isCodexSessionMeta,
  normalizeSessionMeta,
  scanCodexSessions,
} from "./session-index.ts";
