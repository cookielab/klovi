import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getClaudeCodeDir, getProjectsDir, getStatsCachePath, setClaudeCodeDir } from "./config.ts";

describe("config", () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = getClaudeCodeDir();
  });

  afterEach(() => {
    setClaudeCodeDir(originalDir);
  });

  test("getClaudeCodeDir returns default ~/.claude", () => {
    expect(getClaudeCodeDir()).toContain(".claude");
  });

  test("setClaudeCodeDir updates the directory", () => {
    setClaudeCodeDir("/tmp/test-claude");
    expect(getClaudeCodeDir()).toBe("/tmp/test-claude");
  });

  test("getProjectsDir returns projects subdirectory", () => {
    setClaudeCodeDir("/tmp/test-claude");
    expect(getProjectsDir()).toBe("/tmp/test-claude/projects");
  });

  test("getStatsCachePath returns stats-cache.json path", () => {
    setClaudeCodeDir("/tmp/test-claude");
    expect(getStatsCachePath()).toBe("/tmp/test-claude/stats-cache.json");
  });
});
