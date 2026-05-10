import { join } from "node:path";

const DEFAULT_CLAUDE_CODE_DIR = join(Bun.env["HOME"] ?? Bun.env["USERPROFILE"] ?? "", ".claude");

// Legacy mutable state — kept for backwards compatibility with tests/callers
// that haven't migrated to PluginConfig yet. New code should use PluginConfig.
let claudeCodeDir = DEFAULT_CLAUDE_CODE_DIR;

function getClaudeCodeDir(): string {
	return claudeCodeDir;
}

function setClaudeCodeDir(dir: string): void {
	claudeCodeDir = dir;
}

function getProjectsDir(): string {
	return join(claudeCodeDir, "projects");
}

export { DEFAULT_CLAUDE_CODE_DIR, getClaudeCodeDir, getProjectsDir, setClaudeCodeDir };
