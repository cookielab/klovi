import type {
	DashboardStats,
	ModelTokenUsage,
	RegistryRequirements,
	SessionSummary,
	TokenUsage,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer, parseSessionId } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import type { MergedProject } from "./plugin-types";
import type { PluginRegistry } from "./registry";


const N_7 = 7;

type SessionWithProject = {
	project: MergedProject;
	session: SessionSummary;
};

function emptyStats(projects = 0): DashboardStats {
	return {
		projects: projects,
		sessions: 0,
		messages: 0,
		todaySessions: 0,
		thisWeekSessions: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheCreationTokens: 0,
		toolCalls: 0,
		models: {},
	};
}

function toDateString(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countRecentSessions(sessions: SessionSummary[]): {
	todaySessions: number;
	thisWeekSessions: number;
} {
	const today = toDateString(new Date());
	const now = new Date();
	const daysPerWeek = N_7;
	const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysPerWeek);
	const weekAgoStr = toDateString(weekAgo);

	let todaySessions = 0;
	let thisWeekSessions = 0;

	for (const session of sessions) {
		const d = new Date(session.timestamp);
		if (Number.isNaN(d.getTime())) {
			continue;
		}
		const sessionDay = toDateString(d);
		if (sessionDay === today) {
			todaySessions += 1;
		}
		if (sessionDay >= weekAgoStr) {
			thisWeekSessions += 1;
		}
	}

	return { todaySessions: todaySessions, thisWeekSessions: thisWeekSessions };
}

function ensureModelUsage(models: Record<string, ModelTokenUsage>, model: string): ModelTokenUsage {
	const existing = models[model];
	if (existing) {
		return existing;
	}

	const usage: ModelTokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheCreationTokens: 0,
	};
	models[model] = usage;
	return usage;
}

function countVisibleMessages(turns: Turn[]): number {
	return turns.filter((turn) => turn.kind !== "parse_error").length;
}

function collectSessionsWithProjects(
	registry: PluginRegistry,
	stats: DashboardStats,
): Effect.Effect<SessionWithProject[], never, RegistryRequirements> {
	return Effect.gen(function* () {
		const discovered = yield* registry.discoverAllProjectsWithSessions();
		stats.projects = discovered.projects.length;

		const sessionsWithProject: SessionWithProject[] = [];
		for (const project of discovered.projects) {
			const sessions = discovered.sessionsByEncodedPath.get(project.encodedPath) ?? [];
			stats.sessions += sessions.length;
			for (const session of sessions) {
				sessionsWithProject.push({ project: project, session: session });
			}
		}

		return sessionsWithProject;
	});
}

function applyRecentSessionStats(stats: DashboardStats, sessionsWithProject: SessionWithProject[]): void {
	const recent = countRecentSessions(sessionsWithProject.map((item) => item.session));
	stats.todaySessions = recent.todaySessions;
	stats.thisWeekSessions = recent.thisWeekSessions;
}

function loadSessionForStats(
	registry: PluginRegistry,
	project: SessionWithProject["project"],
	session: SessionSummary,
): Effect.Effect<Turn[] | null, never, RegistryRequirements> {
	return Effect.gen(function* () {
		if (!session.pluginId) {
			return null;
		}

		const source = project.sources.find((item) => item.pluginId === session.pluginId);
		if (!source) {
			return null;
		}

		const plugin = registry.getPlugin(session.pluginId);
		const pluginConfig = registry.getPluginConfig(session.pluginId);
		const { rawSessionId } = parseSessionId(session.sessionId);
		const configLayer = makePluginConfigLayer(pluginConfig);
		const loaded = yield* plugin.loadSession(source.nativeId, rawSessionId).pipe(
			Effect.provide(configLayer),
			Effect.catchAll(() => Effect.succeed(null)),
		);
		return loaded?.turns ?? null;
	});
}

function applyUsageStats(stats: DashboardStats, modelUsage: ModelTokenUsage, usage: TokenUsage): void {
	stats.inputTokens += usage.inputTokens;
	stats.outputTokens += usage.outputTokens;
	stats.cacheReadTokens += usage.cacheReadTokens ?? 0;
	stats.cacheCreationTokens += usage.cacheCreationTokens ?? 0;

	modelUsage.inputTokens += usage.inputTokens;
	modelUsage.outputTokens += usage.outputTokens;
	modelUsage.cacheReadTokens += usage.cacheReadTokens ?? 0;
	modelUsage.cacheCreationTokens += usage.cacheCreationTokens ?? 0;
}

function totalUsageTokens(usage: TokenUsage): number {
	return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
}

function applyTurnStats(stats: DashboardStats, turns: Turn[], fallbackModel: string): void {
	stats.messages += countVisibleMessages(turns);

	for (const turn of turns) {
		if (turn.kind !== "assistant") {
			continue;
		}

		stats.toolCalls += turn.contentBlocks.filter((block) => block.type === "tool_call").length;
		if (!turn.usage || totalUsageTokens(turn.usage) <= 0) {
			continue;
		}

		const modelUsage = ensureModelUsage(stats.models, turn.model || fallbackModel || "unknown");
		applyUsageStats(stats, modelUsage, turn.usage);
	}
}

function computeStats(registry: PluginRegistry): Effect.Effect<DashboardStats, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const stats = emptyStats();
		const sessionsWithProject = yield* collectSessionsWithProjects(registry, stats);

		applyRecentSessionStats(stats, sessionsWithProject);

		const turnsPerSession = yield* Effect.forEach(
			sessionsWithProject,
			(item) =>
				loadSessionForStats(registry, item.project, item.session).pipe(
					Effect.map((turns) => ({ item: item, turns: turns })),
				),
			{ concurrency: "unbounded" },
		);

		for (const { item, turns } of turnsPerSession) {
			if (!turns) {
				continue;
			}
			applyTurnStats(stats, turns, item.session.model);
		}

		return stats;
	});
}

export function scanStats(registry: PluginRegistry): Effect.Effect<DashboardStats, never, RegistryRequirements> {
	return computeStats(registry);
}
