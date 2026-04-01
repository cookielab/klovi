import { DashboardStats as UiDashboardStats } from "@cookielab.io/klovi-ui-components/sessions";
import { useKloviClient } from "../../../lib/context.ts";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";

export function PackageDashboardStats() {
	const client = useKloviClient();
	const { data, loading, error, retry } = useRPC<{ stats: Stats }>(() => client.getStats(), [client]);

	return <UiDashboardStats stats={data?.stats ?? null} loading={loading} error={error ?? undefined} onRetry={retry} />;
}
