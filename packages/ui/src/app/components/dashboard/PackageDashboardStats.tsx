import { DashboardStats as UiDashboardStats } from "@cookielab.io/klovi-ui-components/sessions";
import { useKloviClient } from "../../../lib/context.ts";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect.ts";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { useEffectQuery } from "../../hooks/useEffectQuery.ts";

export function PackageDashboardStats() {
	const client = useKloviClient();
	const { data, loading, error, retry } = useEffectQuery<{ stats: Stats }>(() => client.getStats(), [client]);

	return (
		<UiDashboardStats
			stats={data?.stats ?? null}
			loading={loading}
			error={error ? getRpcErrorMessage(error) : undefined}
			onRetry={retry}
		/>
	);
}
