import type { ToolPlugin } from "../../../shared/plugin-types.ts";
import { getOpenCodeDir } from "../../config.ts";
import { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery.ts";
import { loadOpenCodeSession } from "./parser.ts";

export const openCodePlugin: ToolPlugin = {
  id: "opencode",
  displayName: "OpenCode",
  getDefaultDataDir: () => getOpenCodeDir(),
  discoverProjects: () => discoverOpenCodeProjects(),
  listSessions: (nativeId: string) => listOpenCodeSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) => loadOpenCodeSession(nativeId, sessionId),
  // No resume command — OpenCode doesn't have one
};
