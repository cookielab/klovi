import { Cause, Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { useKloviClient, useKloviRuntime } from "../../lib/context.ts";
import { normalizeRpcError, type RpcError } from "../../lib/rpc-errors-effect.ts";
import type { Session } from "../../shared/types.ts";
import { useEffectQuery } from "./useEffectQuery.ts";

const HEAD_SIZE = 100;

type SessionDataResult = {
	data: { session: Session } | null;
	loading: boolean;
	error: RpcError | null;
	retry: () => void;
};

export function useSessionData(sessionId: string, project: string): SessionDataResult {
	const client = useKloviClient();
	const runtime = useKloviRuntime();

	const head = useEffectQuery<{ session: Session; totalTurns: number }>(
		() => client.getSessionHead({ sessionId: sessionId, project: project, headSize: HEAD_SIZE }),
		[client, sessionId, project],
	);

	const [tailTurns, setTailTurns] = useState<Session["turns"] | null>(null);
	const [tailError, setTailError] = useState<RpcError | null>(null);

	useEffect(() => {
		setTailTurns(null);
		setTailError(null);
		const fiber = runtime.runFork(
			client.getSessionTail({ sessionId: sessionId, project: project, fromTurn: HEAD_SIZE }).pipe(
				Effect.matchCauseEffect({
					onFailure: (cause) =>
						Effect.sync(() => {
							const failure = Cause.failureOption(cause);
							setTailError(normalizeRpcError(failure._tag === "Some" ? failure.value : Cause.pretty(cause)));
						}),
					onSuccess: (result) =>
						Effect.sync(() => {
							setTailTurns(result.turns);
						}),
				}),
			) as Effect.Effect<void, never, never>,
		);
		return () => {
			Effect.runFork(Fiber.interrupt(fiber));
		};
	}, [client, runtime, sessionId, project]);

	const session = head.data?.session;
	let merged: Session | null = null;
	if (session) {
		merged = tailTurns ? { ...session, turns: [...session.turns, ...tailTurns] } : session;
	}

	return {
		data: merged ? { session: merged } : null,
		loading: head.loading,
		error: head.error ?? tailError,
		retry: head.retry,
	};
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
	const client = useKloviClient();
	return useEffectQuery<{ session: Session }>(
		() => client.getSubAgent({ sessionId: sessionId, project: project, agentId: agentId }),
		[client, sessionId, project, agentId],
	);
}
