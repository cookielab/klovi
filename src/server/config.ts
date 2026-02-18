import { homedir } from "node:os";
import { join } from "node:path";

let claudeCodeDir = join(homedir(), ".claude");

export function getClaudeCodeDir(): string {
  return claudeCodeDir;
}

export function setClaudeCodeDir(dir: string): void {
  claudeCodeDir = dir;
}

export function getProjectsDir(): string {
  return join(claudeCodeDir, "projects");
}

export function getStatsCachePath(): string {
  return join(claudeCodeDir, "stats-cache.json");
}

// Codex CLI
let codexCliDir = join(homedir(), ".codex");

export function getCodexCliDir(): string {
  return codexCliDir;
}

export function setCodexCliDir(dir: string): void {
  codexCliDir = dir;
}

// OpenCode
let openCodeDir = join(homedir(), ".local", "share", "opencode");

export function getOpenCodeDir(): string {
  return openCodeDir;
}

export function setOpenCodeDir(dir: string): void {
  openCodeDir = dir;
}
