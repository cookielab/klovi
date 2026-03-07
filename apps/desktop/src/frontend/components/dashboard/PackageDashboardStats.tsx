import { DashboardStats as UIDashboardStats } from "@cookielab.io/klovi-ui/sessions";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";

export function PackageDashboardStats() {
  const { data, loading, error, retry } = useRPC<{ stats: Stats }>(
    () => getRPC().request.getStats({}),
    [],
  );

  return (
    <UIDashboardStats
      stats={data?.stats ?? null}
      loading={loading}
      error={error ?? undefined}
      onRetry={retry}
    />
  );
}
