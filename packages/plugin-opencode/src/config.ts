import { join } from "node:path";
import process from "node:process";

const DEFAULT_OPENCODE_DIR = join(
	// biome-ignore lint/style/noProcessEnv: plugin must run under Node (smoke tests) and Bun
	process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
	".local",
	"share",
	"opencode",
);

// Legacy mutable state — kept for backwards compatibility
let openCodeDir = DEFAULT_OPENCODE_DIR;

function getOpenCodeDir(): string {
	return openCodeDir;
}

function setOpenCodeDir(dir: string): void {
	openCodeDir = dir;
}

export { DEFAULT_OPENCODE_DIR, getOpenCodeDir, setOpenCodeDir };
