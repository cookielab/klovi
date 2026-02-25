import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getClaudeCodeDir,
  getCodexCliDir,
  getOpenCodeDir,
  getProjectsDir,
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

  // biome-ignore lint/security/noSecrets: test data, not a real secret
  test("getCodexCliDir returns default ~/.codex", () => {
    expect(getCodexCliDir()).toContain(".codex");
  });

  // biome-ignore lint/security/noSecrets: test data, not a real secret
  test("setCodexCliDir updates the directory", () => {
    setCodexCliDir("/tmp/test-codex");
    expect(getCodexCliDir()).toBe("/tmp/test-codex");
  });

  // biome-ignore lint/security/noSecrets: test data, not a real secret
  test("getOpenCodeDir returns default path", () => {
    expect(getOpenCodeDir()).toContain("opencode");
  });

  // biome-ignore lint/security/noSecrets: test data, not a real secret
  test("setOpenCodeDir updates the directory", () => {
    setOpenCodeDir("/tmp/test-opencode");
    expect(getOpenCodeDir()).toBe("/tmp/test-opencode");
  });
});
