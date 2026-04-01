import { join } from "node:path";

export const DEFAULT_CLAUDE_CODE_DIR = join(process.env["HOME"] ?? process.env["USERPROFILE"] ?? "", ".claude");

// Legacy mutable state — kept for backwards compatibility with tests/callers
// that haven't migrated to PluginConfig yet. New code should use PluginConfig.
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
