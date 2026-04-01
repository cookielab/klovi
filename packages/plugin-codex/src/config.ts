import { join } from "node:path";

export const DEFAULT_CODEX_CLI_DIR = join(process.env["HOME"] ?? process.env["USERPROFILE"] ?? "", ".codex");

// Legacy mutable state — kept for backwards compatibility
let codexCliDir = DEFAULT_CODEX_CLI_DIR;

export function getCodexCliDir(): string {
	return codexCliDir;
}

export function setCodexCliDir(dir: string): void {
	codexCliDir = dir;
}
