import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getClaudeCodeDir,
  getCodexCliDir,
  getOpenCodeDir,
  getProjectsDir,
  getStatsCachePath,
  setClaudeCodeDir,
  setCodexCliDir,
  setOpenCodeDir,
} from "./config.ts";

describe("config", () => {
  let originalClaudeDir: string;
  let originalCodexDir: string;
  let originalOpenCodeDir: string;

  beforeEach(() => {
    originalClaudeDir = getClaudeCodeDir();
    originalCodexDir = getCodexCliDir();
    originalOpenCodeDir = getOpenCodeDir();
  });

  afterEach(() => {
    setClaudeCodeDir(originalClaudeDir);
    setCodexCliDir(originalCodexDir);
    setOpenCodeDir(originalOpenCodeDir);
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

  test("getCodexCliDir returns default ~/.codex", () => {
    expect(getCodexCliDir()).toContain(".codex");
  });

  test("setCodexCliDir updates the directory", () => {
    setCodexCliDir("/tmp/test-codex");
    expect(getCodexCliDir()).toBe("/tmp/test-codex");
  });

  test("getOpenCodeDir returns default path", () => {
    expect(getOpenCodeDir()).toContain("opencode");
  });

  test("setOpenCodeDir updates the directory", () => {
    setOpenCodeDir("/tmp/test-opencode");
    expect(getOpenCodeDir()).toBe("/tmp/test-opencode");
  });
});
