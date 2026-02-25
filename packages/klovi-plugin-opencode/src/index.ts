import { existsSync } from "node:fs";
import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { getOpenCodeDir } from "./config.ts";
import { getOpenCodeDbPath } from "./db.ts";
import { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery.ts";
import { loadOpenCodeSession } from "./parser.ts";

export const openCodePlugin: ToolPlugin<string, SessionSummary, Session> = {
  id: "opencode",
  displayName: "OpenCode",
  getDefaultDataDir: () => getOpenCodeDir(),
  isDataAvailable: () => existsSync(getOpenCodeDbPath()),
  discoverProjects: () => discoverOpenCodeProjects(),
  listSessions: (nativeId: string) => listOpenCodeSessions(nativeId),
  loadSession: (nativeId: string, sessionId: string) => loadOpenCodeSession(nativeId, sessionId),
  // No resume command — OpenCode doesn't have one
};

export { DEFAULT_OPENCODE_DIR, getOpenCodeDir, setOpenCodeDir } from "./config.ts";
export type { SqliteDb, SqliteQuery } from "./db.ts";
export { getOpenCodeDbPath as getDbPath, openOpenCodeDb } from "./db.ts";
export { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery.ts";
export { openCodeInputFormatters, openCodeSummaryExtractors } from "./extractors.ts";
export { openCodeFrontendPlugin } from "./frontend.ts";
export type { OpenCodeMessage } from "./parser.ts";
export { buildOpenCodeTurns, loadOpenCodeSession } from "./parser.ts";
