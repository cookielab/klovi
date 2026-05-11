import { join } from "node:path";
import process from "node:process";

// biome-ignore lint/style/noProcessEnv: plugin must run under Node (smoke tests) and Bun
const DEFAULT_CLAUDE_CODE_DIR = join(process.env["HOME"] ?? process.env["USERPROFILE"] ?? "", ".claude");

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
