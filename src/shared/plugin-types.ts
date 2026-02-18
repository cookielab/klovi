import type { Session, SessionSummary } from "./types.ts";

export interface PluginProject {
  pluginId: string;
  nativeId: string; // plugin-specific identifier (e.g., encoded path for Claude)
  resolvedPath: string; // canonical filesystem path
  displayName: string;
  sessionCount: number;
  lastActivity: string;
}

export interface MergedProject {
  encodedPath: string; // URL-safe identifier (derived from resolvedPath)
  resolvedPath: string;
  name: string;
  fullPath: string;
  sessionCount: number;
  lastActivity: string;
  sources: Array<{
    pluginId: string;
    nativeId: string;
  }>;
}

export interface Badge {
  label: string;
  className: string;
}

export interface ToolPlugin {
  id: string;
  displayName: string;

  getDefaultDataDir(): string | null;
  discoverProjects(): Promise<PluginProject[]>;
  listSessions(nativeId: string): Promise<SessionSummary[]>;
  loadSession(nativeId: string, sessionId: string): Promise<Session>;

  getResumeCommand?(sessionId: string): string | null;
  getSessionBadges?(session: SessionSummary): Badge[];
}
