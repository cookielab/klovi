import type { ToolPlugin } from "../../shared/plugin-types.ts";
import { getCodexCliDir } from "../config.ts";
import { discoverCodexProjects, listCodexSessions } from "./discovery.ts";
import { loadCodexSession } from "./parser.ts";

export const codexCliPlugin: ToolPlugin = {
  id: "codex-cli",
  displayName: "Codex",
  getDefaultDataDir: () => getCodexCliDir(),
  discoverProjects: () => discoverCodexProjects(),
  listSessions: (nativeId: string) => listCodexSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) => loadCodexSession(nativeId, sessionId),
  getResumeCommand: (sessionId: string) => `codex resume ${sessionId}`,
};
