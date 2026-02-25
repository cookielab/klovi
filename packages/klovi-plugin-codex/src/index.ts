import { existsSync } from "node:fs";
import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { getCodexCliDir } from "./config.ts";
import { discoverCodexProjects, listCodexSessions } from "./discovery.ts";
import { loadCodexSession } from "./parser.ts";

export const codexCliPlugin: ToolPlugin<string, SessionSummary, Session> = {
  id: "codex-cli",
  displayName: "Codex",
  getDefaultDataDir: () => getCodexCliDir(),
  isDataAvailable: () => existsSync(getCodexCliDir()),
  discoverProjects: () => discoverCodexProjects(),
  listSessions: (nativeId: string) => listCodexSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) => loadCodexSession(nativeId, sessionId),
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
