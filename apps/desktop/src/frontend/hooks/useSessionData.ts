import type { Session } from "../../shared/types.ts";
import { getRPC } from "../rpc.ts";
import { useRPC } from "./useRpc.ts";

export function useSessionData(sessionId: string, project: string) {
  return useRPC<{ session: Session }>(
    () => getRPC().request.getSession({ sessionId, project }),
    [sessionId, project],
  );
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
  return useRPC<{ session: Session }>(
    () => getRPC().request.getSubAgent({ sessionId, project, agentId }),
    [sessionId, project, agentId],
  );
}
