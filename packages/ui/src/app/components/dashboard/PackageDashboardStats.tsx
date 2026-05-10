import { DashboardStats as UiDashboardStats } from "@cookielab.io/klovi-ui-components/sessions";
import { useEffect, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect";
import type { DashboardStats as Stats, StatsResponse } from "../../../shared/types";
import { useEffectQuery } from "../../hooks/useEffectQuery";

const STATS_REFRESH_POLL_MS = 1000;

export function PackageDashboardStats(): React.ReactNode {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const { data, loading, error, retry } = useEffectQuery<StatsResponse>(() => client.getStats(), [client]);
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

	useEffect(() => {
		if (!(data?.refreshing && stats !== null)) {
			return;
		}

		const timeoutId = globalThis.setTimeout(() => {
			retry();
		}, STATS_REFRESH_POLL_MS);

		return () => {
			globalThis.clearTimeout(timeoutId);
		};
	}, [data?.refreshing, retry, stats]);

	const isLoading = loading && stats === null;
	const isRefreshing = data?.refreshing === true && stats !== null;
	const errorMessage = stats !== null || !error ? undefined : getRpcErrorMessage(error);

	return (
		<UiDashboardStats
			stats={stats}
			loading={isLoading}
			refreshing={isRefreshing}
			error={errorMessage}
			onRetry={retry}
		/>
	);
}
