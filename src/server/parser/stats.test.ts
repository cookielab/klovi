import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setClaudeCodeDir } from "../config.ts";
import { scanStats } from "./stats.ts";

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `klovi-stats-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeCacheFile(dir: string, cache: object): void {
  writeFileSync(join(dir, "stats-cache.json"), JSON.stringify(cache));
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("scanStats with cache file", () => {
  test("loads stats from valid cache file", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, "s1.jsonl"), "");

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 42,
      totalMessages: 1000,
      dailyActivity: [
        { date: "2026-01-01", sessionCount: 3, toolCallCount: 50, messageCount: 100 },
      ],
      modelUsage: {
        "claude-opus-4-6": {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 20,
          cacheCreationInputTokens: 10,
        },
      },
    });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(42);
    expect(stats.messages).toBe(1000);
    expect(stats.inputTokens).toBe(100);
    expect(stats.outputTokens).toBe(50);
    expect(stats.cacheReadTokens).toBe(20);
    expect(stats.cacheCreationTokens).toBe(10);
    expect(stats.toolCalls).toBe(50);
  });

  test("sums tokens from multiple models", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 10,
      totalMessages: 500,
      dailyActivity: [],
      modelUsage: {
        "claude-opus-4-6": {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 20,
          cacheCreationInputTokens: 10,
        },
        "claude-sonnet-4-5-20250929": {
          inputTokens: 200,
          outputTokens: 80,
          cacheReadInputTokens: 30,
          cacheCreationInputTokens: 5,
        },
      },
    });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(130);
    expect(stats.cacheReadTokens).toBe(50);
    expect(stats.cacheCreationTokens).toBe(15);
    expect(stats.models["claude-opus-4-6"]!.inputTokens).toBe(100);
    expect(stats.models["claude-sonnet-4-5-20250929"]!.outputTokens).toBe(80);
  });

  test("computes todaySessions from dailyActivity", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 10,
      totalMessages: 100,
      dailyActivity: [
        { date: todayString(), sessionCount: 5, toolCallCount: 10, messageCount: 20 },
        { date: "2025-01-01", sessionCount: 3, toolCallCount: 5, messageCount: 10 },
      ],
      modelUsage: {},
    });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.todaySessions).toBe(5);
  });

  test("computes thisWeekSessions from dailyActivity", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 10,
      totalMessages: 100,
      dailyActivity: [
        { date: fmt(today), sessionCount: 2, toolCallCount: 0, messageCount: 0 },
        { date: fmt(yesterday), sessionCount: 3, toolCallCount: 0, messageCount: 0 },
        { date: fmt(lastWeek), sessionCount: 100, toolCallCount: 0, messageCount: 0 },
      ],
      modelUsage: {},
    });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.thisWeekSessions).toBe(5);
  });

  test("returns empty stats when cache has wrong version", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeCacheFile(tmpDir, { version: 999, totalSessions: 0 });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(0);
    expect(stats.sessions).toBe(0);
  });

  test("returns empty stats when cache is malformed", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeFileSync(join(tmpDir, "stats-cache.json"), "not valid json");

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(0);
    expect(stats.sessions).toBe(0);
  });

  test("handles missing projects directory", async () => {
    setClaudeCodeDir("/nonexistent/path/that/does/not/exist");
    const stats = await scanStats();
    expect(stats.projects).toBe(0);
    expect(stats.sessions).toBe(0);
  });
});
