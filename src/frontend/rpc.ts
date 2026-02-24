import type {
  DashboardStats,
  GlobalSessionResult,
  Project,
  Session,
  SessionSummary,
} from "../shared/types.ts";

export interface RPCClient {
  request: {
    acceptRisks: (params: Record<string, never>) => Promise<{ ok: boolean }>;
    getVersion: (params: Record<string, never>) => Promise<{ version: string; commit: string }>;
    getStats: (params: Record<string, never>) => Promise<{ stats: DashboardStats }>;
    getProjects: (params: Record<string, never>) => Promise<{ projects: Project[] }>;
    getSessions: (params: { encodedPath: string }) => Promise<{ sessions: SessionSummary[] }>;
    getSession: (params: { sessionId: string; project: string }) => Promise<{ session: Session }>;
    getSubAgent: (params: {
      sessionId: string;
      project: string;
      agentId: string;
    }) => Promise<{ session: Session }>;
    searchSessions: (params: Record<string, never>) => Promise<{ sessions: GlobalSessionResult[] }>;
  };
}

let rpcClient: RPCClient | null = null;

export function setRPCClient(client: RPCClient): void {
  rpcClient = client;
}

export function getRPC(): RPCClient {
  if (!rpcClient) throw new Error("RPC client not initialized");
  return rpcClient;
}
