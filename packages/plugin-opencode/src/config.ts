import { join } from "node:path";

export const DEFAULT_OPENCODE_DIR = join(
  process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
  ".local",
  "share",
  "opencode",
);

// Legacy mutable state — kept for backwards compatibility
let openCodeDir = DEFAULT_OPENCODE_DIR;

export function getOpenCodeDir(): string {
  return openCodeDir;
}

export function setOpenCodeDir(dir: string): void {
  openCodeDir = dir;
}
