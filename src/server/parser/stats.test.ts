import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setClaudeCodeDir, setCodexCliDir, setOpenCodeDir } from "../config.ts";
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

let tmpDir: string;

function isolateToolDirs(claudeDir: string): void {
  setClaudeCodeDir(claudeDir);
  // Prevent other plugins from registering during tests
  setCodexCliDir("/nonexistent/codex-cli-dir");
  setOpenCodeDir("/nonexistent/opencode-dir");
}

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

    isolateToolDirs(tmpDir);
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

    isolateToolDirs(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(130);
    expect(stats.cacheReadTokens).toBe(50);
    expect(stats.cacheCreationTokens).toBe(15);
    expect(stats.models["claude-opus-4-6"]!.inputTokens).toBe(100);
    expect(stats.models["claude-sonnet-4-5-20250929"]!.outputTokens).toBe(80);
  });

  test("computes todaySessions from jsonl file mtimes", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });

    // Create 5 .jsonl files with today's mtime (default)
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(proj, `session-${i}.jsonl`), "");
    }

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 10,
      totalMessages: 100,
      dailyActivity: [],
      modelUsage: {},
    });

    isolateToolDirs(tmpDir);
    const stats = await scanStats();
    expect(stats.todaySessions).toBe(5);
  });

  test("computes thisWeekSessions from jsonl file mtimes", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });

    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);

    // 2 files with today's mtime (default)
    writeFileSync(join(proj, "today-1.jsonl"), "");
    writeFileSync(join(proj, "today-2.jsonl"), "");

    // 3 files with yesterday's mtime (within last week)
    for (let i = 0; i < 3; i++) {
      const filePath = join(proj, `yesterday-${i}.jsonl`);
      writeFileSync(filePath, "");
      utimesSync(filePath, yesterday, yesterday);
    }

    // 1 file from 10 days ago (outside last week)
    const oldFile = join(proj, "old.jsonl");
    writeFileSync(oldFile, "");
    utimesSync(oldFile, tenDaysAgo, tenDaysAgo);

    writeCacheFile(tmpDir, {
      version: 2,
      totalSessions: 10,
      totalMessages: 100,
      dailyActivity: [],
      modelUsage: {},
    });

    isolateToolDirs(tmpDir);
    const stats = await scanStats();
    expect(stats.todaySessions).toBe(2);
    expect(stats.thisWeekSessions).toBe(5);
  });

  test("returns empty stats when cache has wrong version", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeCacheFile(tmpDir, { version: 999, totalSessions: 0 });

    isolateToolDirs(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(0);
    expect(stats.sessions).toBe(0);
  });

  test("returns empty stats when cache is malformed", async () => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, "projects"), { recursive: true });

    writeFileSync(join(tmpDir, "stats-cache.json"), "not valid json");

    isolateToolDirs(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(0);
    expect(stats.sessions).toBe(0);
  });

  test("handles missing projects directory", async () => {
    isolateToolDirs("/nonexistent/path/that/does/not/exist");
    const stats = await scanStats();
    expect(stats.projects).toBe(0);
    expect(stats.sessions).toBe(0);
  });
});
