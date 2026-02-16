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

function writeJsonl(filePath: string, lines: object[]): void {
  writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join("\n"));
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
    writeJsonl(join(proj, "s1.jsonl"), []);

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

  test("falls back to scanning when cache has wrong version", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "Hi" }],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ]);

    writeCacheFile(tmpDir, { version: 999, totalSessions: 0 });

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(100);
    expect(stats.sessions).toBe(1);
  });

  test("falls back to scanning when cache is malformed", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "Hi" }],
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      },
    ]);

    writeFileSync(join(tmpDir, "stats-cache.json"), "not valid json");

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(50);
  });
});

describe("scanStats JSONL fallback", () => {
  test("counts projects and sessions", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "session1.jsonl"), [
      { type: "user", message: { role: "user", content: "Hello" } },
    ]);
    writeJsonl(join(proj, "session2.jsonl"), [
      { type: "user", message: { role: "user", content: "World" } },
    ]);

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(2);
  });

  test("sums token usage from assistant messages", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "Hi" }],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 20,
            cache_creation_input_tokens: 10,
          },
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "More" }],
          usage: {
            input_tokens: 200,
            output_tokens: 80,
            cache_read_input_tokens: 30,
            cache_creation_input_tokens: 5,
          },
        },
      },
    ]);

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(130);
    expect(stats.cacheReadTokens).toBe(50);
    expect(stats.cacheCreationTokens).toBe(15);
  });

  test("counts tool_use blocks", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [
            { type: "text", text: "Let me check" },
            { type: "tool_use", id: "t1", name: "Read", input: {} },
            { type: "tool_use", id: "t2", name: "Write", input: {} },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      },
    ]);

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.toolCalls).toBe(2);
  });

  test("tracks model token usage", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: "Hi",
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: "Hey",
          usage: { input_tokens: 200, output_tokens: 80 },
        },
      },
    ]);

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.models["claude-opus-4-6"]!.inputTokens).toBe(100);
    expect(stats.models["claude-opus-4-6"]!.outputTokens).toBe(50);
    expect(stats.models["claude-sonnet-4-5-20250929"]!.inputTokens).toBe(200);
  });

  test("skips non-assistant lines", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeJsonl(join(proj, "s1.jsonl"), [
      { type: "user", message: { role: "user", content: "Hello" } },
      { type: "system", message: { content: "System init" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: [{ type: "text", text: "Response" }],
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      },
    ]);

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(50);
    expect(stats.outputTokens).toBe(25);
  });

  test("handles empty and malformed files gracefully", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "projects", "proj1");
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, "empty.jsonl"), "");
    writeFileSync(join(proj, "bad.jsonl"), "not json\n{broken");

    setClaudeCodeDir(tmpDir);
    const stats = await scanStats();
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(2);
    expect(stats.inputTokens).toBe(0);
  });

  test("handles missing projects directory", async () => {
    setClaudeCodeDir("/nonexistent/path/that/does/not/exist");
    const stats = await scanStats();
    expect(stats.projects).toBe(0);
    expect(stats.sessions).toBe(0);
  });
});
