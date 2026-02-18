import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function readDirEntriesSafe(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function listFilesBySuffix(dir: string, suffix: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter((file) => file.endsWith(suffix));
  } catch {
    return [];
  }
}

export async function getLatestMtime(
  dir: string,
  files: string[],
): Promise<string> {
  let lastActivity = "";
  for (const file of files) {
    const fileStat = await stat(join(dir, file)).catch(() => null);
    const mtime = fileStat?.mtime.toISOString();
    if (mtime && mtime > lastActivity) lastActivity = mtime;
  }
  return lastActivity;
}

export function decodeEncodedPath(encoded: string): string {
  // Encoded path has leading dash and dashes for slashes.
  // e.g. "-Users-foo-Workspace-bar" -> "/Users/foo/Workspace/bar"
  // Windows: "-C-Users-foo-bar" -> "C:/Users/foo/bar"
  if (encoded.startsWith("-")) {
    const withSlashes = encoded.slice(1).replace(/-/g, "/");
    if (process.platform === "win32" && /^[A-Za-z]\//.test(withSlashes)) {
      return `${withSlashes[0]}:${withSlashes.slice(1)}`;
    }
    return `/${withSlashes}`;
  }
  return encoded.replace(/-/g, "/");
}
