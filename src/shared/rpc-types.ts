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

// biome-ignore lint/complexity/noBannedTypes: Electrobun RPC schema requires {} for parameterless requests and empty message payloads
export interface KloviRPC {
  bun: RPCSchema<{
    requests: {
      acceptRisks: { params: {}; response: { ok: boolean } };
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
    };
  }>;
}
