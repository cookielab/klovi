import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CODEX_CLI_DIR = join(homedir(), ".codex");

let codexCliDir = DEFAULT_CODEX_CLI_DIR;

export function getCodexCliDir(): string {
  return codexCliDir;
}

export function setCodexCliDir(dir: string): void {
  codexCliDir = dir;
}
