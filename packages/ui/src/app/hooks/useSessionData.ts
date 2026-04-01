import { useKloviClient } from "../../lib/context.ts";
import type { Session } from "../../shared/types.ts";
import { useRPC } from "./useRpc.ts";

export function useSessionData(sessionId: string, project: string) {
	const client = useKloviClient();
	return useRPC<{ session: Session }>(
		() => client.getSession({ sessionId: sessionId, project: project }),
		[client, sessionId, project],
	);
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
	const client = useKloviClient();
	return useRPC<{ session: Session }>(
		() => client.getSubAgent({ sessionId: sessionId, project: project, agentId: agentId }),
		[client, sessionId, project, agentId],
	);
}
