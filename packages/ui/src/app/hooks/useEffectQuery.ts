import { type DependencyList, useCallback, useEffect, useState } from "react";
import { mapToRpcError, type RpcError } from "../../lib/rpc-errors-effect.ts";

type UseEffectQueryResult<T> = {
	data: T | null;
	loading: boolean;
	error: RpcError | null;
	retry: () => void;
};

export function useEffectQuery<T>(rpcCall: () => Promise<T>, deps: DependencyList): UseEffectQueryResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<RpcError | null>(null);
	const [retryCount, setRetryCount] = useState(0);

	const retry = useCallback(() => setRetryCount((c) => c + 1), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryCount triggers refetch on retry(); deps array is spread from caller
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		rpcCall()
			.then((result) => {
				if (!cancelled) {
					setData(result);
					setLoading(false);
				}
			})
			.catch((e) => {
				if (!cancelled) {
					setError(mapToRpcError(e));
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [retryCount, ...deps]);

	return { data: data, loading: loading, error: error, retry: retry };
}
