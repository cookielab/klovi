import { readdir, readFile } from "node:fs/promises";
import type { DashboardStats, ModelTokenUsage } from "../../shared/types.ts";
import { getProjectsDir, getStatsCachePath } from "../config.ts";

interface StatsCacheFile {
  version: number;
  totalSessions: number;
  totalMessages: number;
  dailyActivity: Array<{
    date: string;
    sessionCount: number;
    toolCallCount: number;
  }>;
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
    }
  >;
}

async function loadStatsCache(): Promise<StatsCacheFile | null> {
  try {
    const text = await readFile(getStatsCachePath(), "utf-8");
    const data = JSON.parse(text) as StatsCacheFile;
    if (data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

async function countProjects(): Promise<number> {
  try {
    const entries = await readdir(getProjectsDir(), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWithinLastWeek(dateStr: string): boolean {
  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
  return dateStr >= weekAgoStr;
}

function buildFromCache(cache: StatsCacheFile, projects: number): DashboardStats {
  const today = todayDateString();
  const todayEntry = cache.dailyActivity.find((d) => d.date === today);
  const thisWeekEntries = cache.dailyActivity.filter((d) => isWithinLastWeek(d.date));

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  const models: Record<string, ModelTokenUsage> = {};

  for (const [model, usage] of Object.entries(cache.modelUsage)) {
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    cacheReadTokens += usage.cacheReadInputTokens;
    cacheCreationTokens += usage.cacheCreationInputTokens;
    models[model] = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadInputTokens,
      cacheCreationTokens: usage.cacheCreationInputTokens,
    };
  }

  const toolCalls = cache.dailyActivity.reduce((sum, d) => sum + d.toolCallCount, 0);

  return {
    projects,
    sessions: cache.totalSessions,
    messages: cache.totalMessages,
    todaySessions: todayEntry?.sessionCount ?? 0,
    thisWeekSessions: thisWeekEntries.reduce((sum, d) => sum + d.sessionCount, 0),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    toolCalls,
    models,
  };
}

export async function scanStats(): Promise<DashboardStats> {
  const [cache, projects] = await Promise.all([loadStatsCache(), countProjects()]);

  if (cache) {
    return buildFromCache(cache, projects);
  }

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
