import type { RPCSchema } from "electrobun/bun";
import type {
  DashboardStats,
  GlobalSessionResult,
  Project,
  Session,
  SessionSummary,
} from "./types.ts";

export interface VersionInfo {
  version: string;
  commit: string;
}

export interface PluginSettingInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  dataDir: string;
  defaultDataDir: string;
  isCustomDir: boolean;
}

export interface KloviRPC {
  bun: RPCSchema<{
    requests: {
      acceptRisks: { params: Record<string, never>; response: { ok: boolean } };
      isFirstLaunch: { params: Record<string, never>; response: { firstLaunch: boolean } };
      getVersion: { params: Record<string, never>; response: VersionInfo };
      getStats: { params: Record<string, never>; response: { stats: DashboardStats } };
      getProjects: { params: Record<string, never>; response: { projects: Project[] } };
      getSessions: {
        params: { encodedPath: string };
        response: { sessions: SessionSummary[] };
      };
      getSession: {
        params: { sessionId: string; project: string };
        response: { session: Session };
      };
      getSubAgent: {
        params: { sessionId: string; project: string; agentId: string };
        response: { session: Session };
      };
      searchSessions: {
        params: Record<string, never>;
        response: { sessions: GlobalSessionResult[] };
      };
      getPluginSettings: {
        params: Record<string, never>;
        response: { plugins: PluginSettingInfo[] };
      };
      updatePluginSetting: {
        params: { pluginId: string; enabled?: boolean; dataDir?: string | null };
        response: { plugins: PluginSettingInfo[] };
      };
      getGeneralSettings: {
        params: Record<string, never>;
        response: { showSecurityWarning: boolean };
      };
      updateGeneralSettings: {
        params: { showSecurityWarning?: boolean };
        response: { showSecurityWarning: boolean };
      };
      resetSettings: { params: Record<string, never>; response: { ok: boolean } };
      openExternal: { params: { url: string }; response: { ok: boolean } };
      browseDirectory: {
        params: { startingFolder?: string };
        response: { path: string | null };
      };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      cycleTheme: Record<string, never>;
      increaseFontSize: Record<string, never>;
      decreaseFontSize: Record<string, never>;
      togglePresentation: Record<string, never>;
      openSettings: Record<string, never>;
    };
  }>;
}
