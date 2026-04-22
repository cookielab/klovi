import { DashboardStats as UiDashboardStats } from "@cookielab.io/klovi-ui-components/sessions";
import { useEffect, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context.ts";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect.ts";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { useEffectQuery } from "../../hooks/useEffectQuery.ts";

type StatsCacheStoreV1 = {
	version: 1;
	stats: Stats;
};

const STATS_CACHE_KEY = "klovi-dashboard-stats";

function isStats(value: unknown): value is Stats {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	const requiredNumberFields = [
		"projects",
		"sessions",
		"messages",
		"todaySessions",
		"thisWeekSessions",
		"inputTokens",
		"outputTokens",
		"cacheReadTokens",
		"cacheCreationTokens",
		"toolCalls",
	] as const;

	for (const field of requiredNumberFields) {
		if (typeof candidate[field] !== "number") {
			return false;
		}
	}

	return typeof candidate["models"] === "object" && candidate["models"] !== null;
}

function loadCachedStats(): Stats | null {
	try {
		const raw = localStorage.getItem(STATS_CACHE_KEY);
		if (!raw) {
			return null;
		}

		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"version" in parsed &&
			(parsed as StatsCacheStoreV1).version === 1 &&
			"stats" in parsed &&
			isStats((parsed as StatsCacheStoreV1).stats)
		) {
			return (parsed as StatsCacheStoreV1).stats;
		}
	} catch {
		// Ignore corrupted cache and fall back to a cold load.
	}

	return null;
}

function persistCachedStats(stats: Stats): void {
	try {
		const store: StatsCacheStoreV1 = {
			version: 1,
			stats: stats,
		};
		localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(store));
	} catch {
		// Ignore storage failures; the dashboard still works without persistence.
	}
}

export function PackageDashboardStats() {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const { data, loading, error, retry } = useEffectQuery<{ stats: Stats }>(() => client.getStats(), [client]);
	const [stats, setStats] = useState<Stats | null>(() => loadCachedStats());

	useEffect(() => {
		if (!data?.stats) {
			return;
		}
		persistCachedStats(data.stats);
		setStats(data.stats);
	}, [data]);

	useEffect(
		() =>
			hostBridge.onStatsUpdated((nextStats) => {
				persistCachedStats(nextStats);
				setStats(nextStats);
			}),
		[hostBridge],
	);
	const isLoading = loading && stats === null;
	const isRefreshing = loading && stats !== null;
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
