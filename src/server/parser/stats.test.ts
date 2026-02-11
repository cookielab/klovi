import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setProjectsDir } from "../config.ts";
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

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("scanStats", () => {
  test("counts projects and sessions", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
    writeJsonl(join(proj, "session1.jsonl"), [
      { type: "user", message: { role: "user", content: "Hello" } },
    ]);
    writeJsonl(join(proj, "session2.jsonl"), [
      { type: "user", message: { role: "user", content: "World" } },
    ]);

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(2);
  });

  test("sums token usage from assistant messages", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
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

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(130);
    expect(stats.cacheReadTokens).toBe(50);
    expect(stats.cacheCreationTokens).toBe(15);
  });

  test("counts tool_use blocks", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
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

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.toolCalls).toBe(2);
  });

  test("tracks model frequency", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
    writeJsonl(join(proj, "s1.jsonl"), [
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: "Hi",
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-opus-4-6",
          content: "More",
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-4-5-20250929",
          content: "Hey",
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
    ]);

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.models["claude-opus-4-6"]).toBe(2);
    expect(stats.models["claude-sonnet-4-5-20250929"]).toBe(1);
  });

  test("skips non-assistant lines", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
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

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.inputTokens).toBe(50);
    expect(stats.outputTokens).toBe(25);
  });

  test("handles empty and malformed files gracefully", async () => {
    tmpDir = makeTmpDir();
    const proj = join(tmpDir, "proj1");
    mkdirSync(proj);
    writeFileSync(join(proj, "empty.jsonl"), "");
    writeFileSync(join(proj, "bad.jsonl"), "not json\n{broken");

    setProjectsDir(tmpDir);
    const stats = await scanStats();
    expect(stats.projects).toBe(1);
    expect(stats.sessions).toBe(2);
    expect(stats.inputTokens).toBe(0);
  });

  test("handles missing projects directory", async () => {
    setProjectsDir("/nonexistent/path/that/does/not/exist");
    const stats = await scanStats();
    expect(stats.projects).toBe(0);
    expect(stats.sessions).toBe(0);
  });
});
