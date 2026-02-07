import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const packageJsonPath = new URL("../../package.json", import.meta.url).pathname;
const version: string =
  process.env.KLOVI_VERSION ?? JSON.parse(await readFile(packageJsonPath, "utf-8")).version;

let commitHash: string | null = process.env.KLOVI_COMMIT ?? null;
if (!commitHash) {
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--short", "HEAD"]);
    commitHash = stdout.trim() || null;
  } catch {
    // git not available
  }
}

export const appVersion = { version, commitHash };
