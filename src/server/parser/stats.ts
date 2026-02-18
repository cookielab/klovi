import { parseSessionId } from "../../shared/session-id.ts";
import type { DashboardStats, ModelTokenUsage, SessionSummary, Turn } from "../../shared/types.ts";
import type { PluginRegistry } from "../plugin-registry.ts";
import { createRegistry } from "../registry.ts";

const STATS_CACHE_TTL_MS = 5 * 60 * 1000;

let statsCache: { expiresAt: number; stats: DashboardStats } | null = null;

export function clearStatsCacheForTests(): void {
  statsCache = null;
}

function emptyStats(projects = 0): DashboardStats {
  return {
    projects,
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

function countRecentSessions(sessions: SessionSummary[]): { todaySessions: number; thisWeekSessions: number } {
  const today = toDateString(new Date());
  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const weekAgoStr = toDateString(weekAgo);

  let todaySessions = 0;
  let thisWeekSessions = 0;

  for (const session of sessions) {
    const d = new Date(session.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const sessionDay = toDateString(d);
    if (sessionDay === today) todaySessions++;
    if (sessionDay >= weekAgoStr) thisWeekSessions++;
  }

  return { todaySessions, thisWeekSessions };
}

function ensureModelUsage(models: Record<string, ModelTokenUsage>, model: string): ModelTokenUsage {
  if (!models[model]) {
    models[model] = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
  }
  return models[model]!;
}

function countVisibleMessages(turns: Turn[]): number {
  return turns.filter((turn) => turn.kind !== "parse_error").length;
}

async function computeStats(registry: PluginRegistry): Promise<DashboardStats> {
  const projects = await registry.discoverAllProjects().catch(() => []);
  const stats = emptyStats(projects.length);

  const sessionsWithProject: Array<{
    project: (typeof projects)[number];
    session: SessionSummary;
  }> = [];

  for (const project of projects) {
    const sessions = await registry.listAllSessions(project).catch(() => []);
    stats.sessions += sessions.length;
    for (const session of sessions) {
      sessionsWithProject.push({ project, session });
    }
  }

  const recent = countRecentSessions(sessionsWithProject.map((s) => s.session));
  stats.todaySessions = recent.todaySessions;
  stats.thisWeekSessions = recent.thisWeekSessions;

  for (const { project, session } of sessionsWithProject) {
    if (!session.pluginId) continue;

    const source = project.sources.find((s) => s.pluginId === session.pluginId);
    if (!source) continue;

    const plugin = registry.getPlugin(session.pluginId);
    const { rawSessionId } = parseSessionId(session.sessionId);
    const loaded = await plugin.loadSession(source.nativeId, rawSessionId).catch(() => null);
    if (!loaded) continue;

    stats.messages += countVisibleMessages(loaded.turns);

    for (const turn of loaded.turns) {
      if (turn.kind !== "assistant") continue;

      stats.toolCalls += turn.contentBlocks.filter((b) => b.type === "tool_call").length;

      const model = turn.model || session.model || "unknown";
      const modelUsage = ensureModelUsage(stats.models, model);

      if (!turn.usage) continue;

      stats.inputTokens += turn.usage.inputTokens;
      stats.outputTokens += turn.usage.outputTokens;
      stats.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
      stats.cacheCreationTokens += turn.usage.cacheCreationTokens ?? 0;

      modelUsage.inputTokens += turn.usage.inputTokens;
      modelUsage.outputTokens += turn.usage.outputTokens;
      modelUsage.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
      modelUsage.cacheCreationTokens += turn.usage.cacheCreationTokens ?? 0;
    }
  }

  return stats;
}

export async function scanStats(registry: PluginRegistry = createRegistry()): Promise<DashboardStats> {
  const now = Date.now();
  if (statsCache && statsCache.expiresAt > now) {
    return statsCache.stats;
  }

  const stats = await computeStats(registry);
  statsCache = {
    expiresAt: now + STATS_CACHE_TTL_MS,
    stats,
  };
  return stats;
}
