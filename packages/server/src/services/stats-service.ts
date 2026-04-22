import { dirname, join } from "node:path";
import type { DashboardStats, RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import type { PluginRegistry } from "./registry.ts";
import { scanStats } from "./stats.ts";

type StatsResponse = {
	stats: DashboardStats;
	cachedAt?: string | undefined;
	refreshing: boolean;
};

type StatsCacheFileV1 = {
	version: 1;
	cachedAt: string;
	stats: DashboardStats;
};

const STATS_CACHE_FILENAME = "stats-cache.json";
const refreshBootTimes = new Map<string, string>();
const refreshEpochs = new Map<string, number>();
const refreshingCachePaths = new Set<string>();

function getStatsCachePath(settingsPath: string): string {
	return join(dirname(settingsPath), STATS_CACHE_FILENAME);
}

function getRefreshBootTime(cachePath: string): string {
	const existing = refreshBootTimes.get(cachePath);
	if (existing) {
		return existing;
	}

	const bootTime = new Date().toISOString();
	refreshBootTimes.set(cachePath, bootTime);
	return bootTime;
}

function getRefreshEpoch(cachePath: string): number {
	return refreshEpochs.get(cachePath) ?? 0;
}

function bumpRefreshEpoch(cachePath: string): number {
	const nextEpoch = getRefreshEpoch(cachePath) + 1;
	refreshEpochs.set(cachePath, nextEpoch);
	return nextEpoch;
}

function isDashboardStats(value: unknown): value is DashboardStats {
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

function isStatsCacheFile(value: unknown): value is StatsCacheFileV1 {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		candidate["version"] === 1 && typeof candidate["cachedAt"] === "string" && isDashboardStats(candidate["stats"])
	);
}

function loadStatsCache(settingsPath: string): Effect.Effect<StatsCacheFileV1 | null, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const cachePath = getStatsCachePath(settingsPath);
		const raw = yield* fs.readFileString(cachePath).pipe(Effect.catchAll(() => Effect.succeed(null)));
		if (raw === null) {
			return null;
		}

		const parsed = yield* Effect.try({
			try: () => JSON.parse(raw) as unknown,
			catch: () => null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null)));

		return parsed !== null && isStatsCacheFile(parsed) ? parsed : null;
	});
}

function persistStatsCache(
	settingsPath: string,
	stats: DashboardStats,
	expectedEpoch: number,
): Effect.Effect<string | null, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const cachePath = getStatsCachePath(settingsPath);
		const cacheDir = dirname(cachePath);
		const cachedAt = new Date().toISOString();

		yield* fs.makeDirectory(cacheDir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void));

		if (getRefreshEpoch(cachePath) !== expectedEpoch) {
			return null;
		}

		const tmpPath = join(cacheDir, `.stats-cache-${Date.now()}.tmp`);
		const payload: StatsCacheFileV1 = {
			version: 1,
			cachedAt: cachedAt,
			stats: stats,
		};

		const wroteTempFile = yield* fs.writeFileString(tmpPath, JSON.stringify(payload, null, 2)).pipe(
			Effect.map(() => true),
			Effect.catchAll(() => Effect.succeed(false)),
		);
		if (!wroteTempFile) {
			return null;
		}

		if (getRefreshEpoch(cachePath) !== expectedEpoch) {
			yield* fs.remove(tmpPath).pipe(Effect.catchAll(() => Effect.void));
			return null;
		}

		const renamed = yield* fs.rename(tmpPath, cachePath).pipe(
			Effect.map(() => true),
			Effect.catchAll(() =>
				fs.remove(tmpPath).pipe(
					Effect.catchAll(() => Effect.void),
					Effect.map(() => false),
				),
			),
		);
		if (!renamed) {
			return null;
		}

		return getRefreshEpoch(cachePath) === expectedEpoch ? cachedAt : null;
	});
}

function computeAndPersistStats(
	settingsPath: string,
	registry: PluginRegistry,
	expectedEpoch: number,
): Effect.Effect<{ stats: DashboardStats; cachedAt?: string | undefined }, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const stats = yield* scanStats(registry);
		const cachedAt = yield* persistStatsCache(settingsPath, stats, expectedEpoch);
		return { stats: stats, ...(cachedAt ? { cachedAt: cachedAt } : {}) };
	});
}

function refreshStats(
	settingsPath: string,
	registry: PluginRegistry,
): Effect.Effect<StatsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const cachePath = getStatsCachePath(settingsPath);
		const expectedEpoch = getRefreshEpoch(cachePath);
		refreshingCachePaths.add(cachePath);
		const result = yield* computeAndPersistStats(settingsPath, registry, expectedEpoch);
		return { ...result, refreshing: false };
	}).pipe(
		Effect.ensuring(
			Effect.sync(() => {
				refreshingCachePaths.delete(getStatsCachePath(settingsPath));
			}),
		),
	);
}

function scheduleRefresh(
	settingsPath: string,
	registry: PluginRegistry,
): Effect.Effect<void, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const cachePath = getStatsCachePath(settingsPath);
		if (refreshingCachePaths.has(cachePath)) {
			return;
		}

		const expectedEpoch = getRefreshEpoch(cachePath);
		refreshingCachePaths.add(cachePath);

		yield* computeAndPersistStats(settingsPath, registry, expectedEpoch).pipe(
			Effect.catchAllCause(() => Effect.void),
			Effect.ensuring(
				Effect.sync(() => {
					refreshingCachePaths.delete(cachePath);
				}),
			),
			Effect.forkDaemon,
		);
	});
}

function getStats(
	settingsPath: string,
	registry: PluginRegistry,
): Effect.Effect<StatsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const cachePath = getStatsCachePath(settingsPath);
		const cached = yield* loadStatsCache(settingsPath);

		if (!cached) {
			return yield* refreshStats(settingsPath, registry);
		}

		const bootTime = getRefreshBootTime(cachePath);
		const shouldRefresh = cached.cachedAt < bootTime;
		if (shouldRefresh) {
			yield* scheduleRefresh(settingsPath, registry);
		}

		return {
			stats: cached.stats,
			cachedAt: cached.cachedAt,
			refreshing: shouldRefresh || refreshingCachePaths.has(cachePath),
		};
	});
}

function invalidateStatsCache(settingsPath: string): Effect.Effect<void, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const cachePath = getStatsCachePath(settingsPath);
		bumpRefreshEpoch(cachePath);
		yield* fs.remove(cachePath).pipe(Effect.catchAll(() => Effect.void));
	});
}

export type { StatsResponse };
export { getStats, getStatsCachePath, invalidateStatsCache, refreshStats };
