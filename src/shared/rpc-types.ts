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

// biome-ignore lint/complexity/noBannedTypes: Electrobun RPC schema requires {} for parameterless requests and empty message payloads
export interface KloviRPC {
  bun: RPCSchema<{
    requests: {
      acceptRisks: { params: {}; response: { ok: boolean } };
      isFirstLaunch: { params: {}; response: { firstLaunch: boolean } };
      getVersion: { params: {}; response: VersionInfo };
      getStats: { params: {}; response: { stats: DashboardStats } };
      getProjects: { params: {}; response: { projects: Project[] } };
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
        params: {};
        response: { sessions: GlobalSessionResult[] };
      };
      getPluginSettings: {
        params: {};
        response: { plugins: PluginSettingInfo[] };
      };
      updatePluginSetting: {
        params: { pluginId: string; enabled?: boolean; dataDir?: string | null };
        response: { plugins: PluginSettingInfo[] };
      };
      getGeneralSettings: {
        params: {};
        response: { showSecurityWarning: boolean };
      };
      updateGeneralSettings: {
        params: { showSecurityWarning?: boolean };
        response: { showSecurityWarning: boolean };
      };
      resetSettings: { params: {}; response: { ok: boolean } };
      openExternal: { params: { url: string }; response: { ok: boolean } };
      browseDirectory: {
        params: { startingFolder?: string };
        response: { path: string | null };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      cycleTheme: {};
      increaseFontSize: {};
      decreaseFontSize: {};
      togglePresentation: {};
      openSettings: {};
    };
  }>;
}
