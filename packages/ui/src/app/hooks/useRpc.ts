import { type DependencyList, useCallback, useEffect, useState } from "react";

interface UseRPCResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useRPC<T>(rpcCall: () => Promise<T>, deps: DependencyList): UseRPCResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount, ...deps]);

  return { data, loading, error, retry };
}
