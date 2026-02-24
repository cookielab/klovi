import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CLAUDE_CODE_DIR = join(homedir(), ".claude");
export const DEFAULT_CODEX_CLI_DIR = join(homedir(), ".codex");
export const DEFAULT_OPENCODE_DIR = join(homedir(), ".local", "share", "opencode");

let claudeCodeDir = DEFAULT_CLAUDE_CODE_DIR;

export function getClaudeCodeDir(): string {
  return claudeCodeDir;
}

export function setClaudeCodeDir(dir: string): void {
  claudeCodeDir = dir;
}

export function getProjectsDir(): string {
  return join(claudeCodeDir, "projects");
}

// Codex CLI
let codexCliDir = DEFAULT_CODEX_CLI_DIR;

export function getCodexCliDir(): string {
  return codexCliDir;
}

export function setCodexCliDir(dir: string): void {
  codexCliDir = dir;
}

// OpenCode
let openCodeDir = DEFAULT_OPENCODE_DIR;

export function getOpenCodeDir(): string {
  return openCodeDir;
}

export function setOpenCodeDir(dir: string): void {
  openCodeDir = dir;
}
