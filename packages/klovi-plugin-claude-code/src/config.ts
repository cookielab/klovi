import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CLAUDE_CODE_DIR = join(homedir(), ".claude");

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
