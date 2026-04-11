import { Cause, Effect, Fiber } from "effect";
import { type DependencyList, useCallback, useEffect, useState } from "react";
import { useKloviRuntime } from "../../lib/context.ts";
import { normalizeRpcError, type RpcError } from "../../lib/rpc-errors-effect.ts";

type UseEffectQueryResult<T> = {
	data: T | null;
	loading: boolean;
	error: RpcError | null;
	retry: () => void;
};

export function useEffectQuery<T, E = unknown, R = unknown>(
	effectFactory: () => Effect.Effect<T, E, R>,
	deps: DependencyList,
): UseEffectQueryResult<T> {
	const runtime = useKloviRuntime();
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<RpcError | null>(null);
	const [retryCount, setRetryCount] = useState(0);

	const retry = useCallback(() => setRetryCount((c) => c + 1), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryCount triggers refetch on retry(); deps array is spread from caller
	useEffect(() => {
		setLoading(true);
		setError(null);

		const fiber = runtime.runFork(
			effectFactory().pipe(
				Effect.matchCauseEffect({
					onFailure: (cause) =>
						Effect.sync(() => {
							const failure = Cause.failureOption(cause);
							setError(normalizeRpcError(failure._tag === "Some" ? failure.value : Cause.pretty(cause)));
							setLoading(false);
						}),
					onSuccess: (result) =>
						Effect.sync(() => {
							setData(result);
							setLoading(false);
						}),
				}),
			) as Effect.Effect<void, never, never>,
		);

		return () => {
			Effect.runFork(Fiber.interrupt(fiber));
		};
	}, [runtime, retryCount, ...deps]);

	return { data: data, loading: loading, error: error, retry: retry };
}
