import { readdir, readFile } from "node:fs/promises";
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

  return scanJsonlFallback(projects);
}

async function scanJsonlFallback(projects: number): Promise<DashboardStats> {
  const stats: DashboardStats = {
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

  const projectsDir = getProjectsDir();
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return stats;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(projectsDir, entry.name);
    let files: string[];
    try {
      files = (await readdir(projectDir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    if (files.length === 0) continue;
    stats.sessions += files.length;

    for (const file of files) {
      await scanFile(join(projectDir, file), stats);
    }
  }

  return stats;
}

function extractUsageTokens(usage: Record<string, number> | undefined): ModelTokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

function addModelTokens(target: ModelTokenUsage, source: ModelTokenUsage): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheCreationTokens += source.cacheCreationTokens;
}

function processAssistantLine(msg: Record<string, unknown>, stats: DashboardStats): void {
  const usage = msg.usage as Record<string, number> | undefined;
  const tokens = extractUsageTokens(usage);

  stats.inputTokens += tokens.inputTokens;
  stats.outputTokens += tokens.outputTokens;
  stats.cacheReadTokens += tokens.cacheReadTokens;
  stats.cacheCreationTokens += tokens.cacheCreationTokens;

  const model = msg.model as string | undefined;
  if (model) {
    const existing = stats.models[model];
    if (existing) {
      addModelTokens(existing, tokens);
    } else {
      stats.models[model] = { ...tokens };
    }
  }

  const content = msg.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "tool_use") {
        stats.toolCalls++;
      }
    }
  }
}

async function scanFile(filePath: string, stats: DashboardStats): Promise<void> {
  let text: string;
  try {
    text = await readFile(filePath, "utf-8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "assistant" && obj.message) {
        processAssistantLine(obj.message, stats);
      }
    } catch {
      // skip malformed lines
    }
  }
}
