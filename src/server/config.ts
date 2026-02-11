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
