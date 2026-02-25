import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_OPENCODE_DIR = join(homedir(), ".local", "share", "opencode");

let openCodeDir = DEFAULT_OPENCODE_DIR;

export function getOpenCodeDir(): string {
  return openCodeDir;
}

export function setOpenCodeDir(dir: string): void {
  openCodeDir = dir;
}
