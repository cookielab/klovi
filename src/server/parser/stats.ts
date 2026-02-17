import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
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

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDateString(): string {
  return toDateString(new Date());
}

function isWithinLastWeek(dateStr: string): boolean {
  const now = new Date();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
  return dateStr >= weekAgoStr;
}

async function countRecentSessions(): Promise<{ todaySessions: number; thisWeekSessions: number }> {
  const today = todayDateString();
  const projectsDir = getProjectsDir();
  let todaySessions = 0;
  let thisWeekSessions = 0;

  try {
    const projectDirs = await readdir(projectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projectPath = join(projectsDir, dir.name);
      const files = (await readdir(projectPath)).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const fileStat = await stat(join(projectPath, file));
        const mtimeDate = toDateString(fileStat.mtime);
        if (mtimeDate === today) todaySessions++;
        if (isWithinLastWeek(mtimeDate)) thisWeekSessions++;
      }
    }
  } catch {
    // projects dir doesn't exist or is inaccessible
  }

  return { todaySessions, thisWeekSessions };
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
  const [cache, projects, recent] = await Promise.all([
    loadStatsCache(),
    countProjects(),
    countRecentSessions(),
  ]);

  const base = cache
    ? buildFromCache(cache, projects)
    : {
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

  return {
    ...base,
    todaySessions: recent.todaySessions,
    thisWeekSessions: recent.thisWeekSessions,
  };
}
