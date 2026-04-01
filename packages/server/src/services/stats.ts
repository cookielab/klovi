import type {
	DashboardStats,
	ModelTokenUsage,
	SessionSummary,
	TokenUsage,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
import { parseSessionId } from "@cookielab.io/klovi-plugin-core";
import { runPluginEffect, runRegistryEffect } from "../effect/plugin-runtime.ts";
import type { PluginRegistry } from "./registry.ts";

type SessionWithProject = {
	project: Awaited<ReturnType<typeof runDiscoverProjects>>[number];
	session: SessionSummary;
};

function runDiscoverProjects(registry: PluginRegistry) {
	return runRegistryEffect(registry.discoverAllProjects());
}

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
	const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
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
			todaySessions++;
		}
		if (sessionDay >= weekAgoStr) {
			thisWeekSessions++;
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

async function collectSessionsWithProjects(
	registry: PluginRegistry,
	stats: DashboardStats,
): Promise<SessionWithProject[]> {
	const projects = await runRegistryEffect(registry.discoverAllProjects()).catch(() => []);
	stats.projects = projects.length;

	const sessionsWithProject: SessionWithProject[] = [];
	for (const project of projects) {
		const sessions = await runRegistryEffect(registry.listAllSessions(project)).catch(() => []);
		stats.sessions += sessions.length;
		for (const session of sessions) {
			sessionsWithProject.push({ project: project, session: session });
		}
	}

	return sessionsWithProject;
}

function applyRecentSessionStats(stats: DashboardStats, sessionsWithProject: SessionWithProject[]): void {
	const recent = countRecentSessions(sessionsWithProject.map((item) => item.session));
	stats.todaySessions = recent.todaySessions;
	stats.thisWeekSessions = recent.thisWeekSessions;
}

async function loadSessionForStats(
	registry: PluginRegistry,
	project: SessionWithProject["project"],
	session: SessionSummary,
): Promise<Turn[] | null> {
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
	const loaded = await runPluginEffect(plugin.loadSession(source.nativeId, rawSessionId), pluginConfig).catch(
		() => null,
	);
	return loaded?.turns ?? null;
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

function applyTurnStats(stats: DashboardStats, turns: Turn[], fallbackModel: string): void {
	stats.messages += countVisibleMessages(turns);

	for (const turn of turns) {
		if (turn.kind !== "assistant") {
			continue;
		}

		stats.toolCalls += turn.contentBlocks.filter((block) => block.type === "tool_call").length;
		const modelUsage = ensureModelUsage(stats.models, turn.model || fallbackModel || "unknown");

		if (!turn.usage) {
			continue;
		}
		applyUsageStats(stats, modelUsage, turn.usage);
	}
}

async function computeStats(registry: PluginRegistry): Promise<DashboardStats> {
	const stats = emptyStats();
	const sessionsWithProject = await collectSessionsWithProjects(registry, stats);

	applyRecentSessionStats(stats, sessionsWithProject);

	for (const item of sessionsWithProject) {
		const turns = await loadSessionForStats(registry, item.project, item.session);
		if (!turns) {
			continue;
		}
		applyTurnStats(stats, turns, item.session.model);
	}

	return stats;
}

export function scanStats(registry: PluginRegistry): Promise<DashboardStats> {
	return computeStats(registry);
}
