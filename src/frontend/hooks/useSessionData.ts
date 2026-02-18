import type { Session } from "../../shared/types.ts";
import { useFetch } from "./useFetch.ts";

export function buildSessionUrl(sessionId: string, project: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}?project=${encodeURIComponent(project)}`;
}

export function buildSubAgentSessionUrl(
  sessionId: string,
  project: string,
  agentId: string,
): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}?project=${encodeURIComponent(project)}`;
}

export function useSessionData(sessionId: string, project: string) {
  return useFetch<{ session: Session }>(buildSessionUrl(sessionId, project), [sessionId, project]);
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
  return useFetch<{ session: Session }>(buildSubAgentSessionUrl(sessionId, project, agentId), [
    sessionId,
    project,
    agentId,
  ]);
}
