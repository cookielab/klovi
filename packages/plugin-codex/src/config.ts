import { join } from "node:path";

const DEFAULT_CODEX_CLI_DIR = join(process.env["HOME"] ?? process.env["USERPROFILE"] ?? "", ".codex");

// Legacy mutable state — kept for backwards compatibility
let codexCliDir = DEFAULT_CODEX_CLI_DIR;

function getCodexCliDir(): string {
	return codexCliDir;
}

function setCodexCliDir(dir: string): void {
	codexCliDir = dir;
}

export { DEFAULT_CODEX_CLI_DIR, getCodexCliDir, setCodexCliDir };
