import { DashboardStats as UiDashboardStats } from "@cookielab.io/klovi-ui-components/sessions";
import { useEffect, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context.ts";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect.ts";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { useEffectQuery } from "../../hooks/useEffectQuery.ts";

export function PackageDashboardStats() {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const { data, loading, error, retry } = useEffectQuery<{ stats: Stats }>(() => client.getStats(), [client]);
	const [stats, setStats] = useState<Stats | null>(null);

	useEffect(() => {
		if (!data?.stats) {
			return;
		}
		setStats(data.stats);
	}, [data]);

	useEffect(
		() =>
			hostBridge.onStatsUpdated((nextStats) => {
				setStats(nextStats);
			}),
		[hostBridge],
	);
	const isLoading = loading && stats === null;
	const errorMessage = stats !== null || !error ? undefined : getRpcErrorMessage(error);

	return <UiDashboardStats stats={stats} loading={isLoading} error={errorMessage} onRetry={retry} />;
}
