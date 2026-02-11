import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DashboardStats } from "../../shared/types.ts";
import { getProjectsDir } from "../config.ts";

export async function scanStats(): Promise<DashboardStats> {
  const stats: DashboardStats = {
    projects: 0,
    sessions: 0,
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
    stats.projects++;
    stats.sessions += files.length;

    for (const file of files) {
      await scanFile(join(projectDir, file), stats);
    }
  }

  return stats;
}

function processAssistantLine(msg: Record<string, unknown>, stats: DashboardStats): void {
  const usage = msg.usage as Record<string, number> | undefined;
  if (usage) {
    stats.inputTokens += usage.input_tokens ?? 0;
    stats.outputTokens += usage.output_tokens ?? 0;
    stats.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
    stats.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0;
  }

  const model = msg.model as string | undefined;
  if (model) {
    stats.models[model] = (stats.models[model] ?? 0) + 1;
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
