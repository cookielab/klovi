import type { Dirent } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sortByIsoDesc } from "../../shared/iso-time.ts";

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//;

export interface FileWithMtime {
  fileName: string;
  mtime: string;
}

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

export async function getLatestMtime(dir: string, files: string[]): Promise<string> {
  let lastActivity = "";
  for (const file of files) {
    const fileStat = await stat(join(dir, file)).catch(() => null);
    const mtime = fileStat?.mtime.toISOString();
    if (mtime && mtime > lastActivity) lastActivity = mtime;
  }
  return lastActivity;
}

export async function listFilesWithMtime(dir: string, suffix: string): Promise<FileWithMtime[]> {
  const files = await listFilesBySuffix(dir, suffix);
  const results: FileWithMtime[] = [];

  for (const fileName of files) {
    const fileStat = await stat(join(dir, fileName)).catch(() => null);
    const mtime = fileStat?.mtime.toISOString();
    if (mtime) {
      results.push({ fileName, mtime });
    }
  }

  sortByIsoDesc(results, (item) => item.mtime);
  return results;
}

export async function readTextPrefix(filePath: string, maxBytes: number): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.toString("utf-8", 0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function decodeEncodedPath(encoded: string): string {
  // Encoded path has leading dash and dashes for slashes.
  // e.g. "-Users-foo-Workspace-bar" -> "/Users/foo/Workspace/bar"
  // Windows: "-C-Users-foo-bar" -> "C:/Users/foo/bar"
  if (encoded.startsWith("-")) {
    const withSlashes = encoded.slice(1).replace(/-/g, "/");
    if (process.platform === "win32" && WINDOWS_DRIVE_LETTER_REGEX.test(withSlashes)) {
      return `${withSlashes[0]}:${withSlashes.slice(1)}`;
    }
    return `/${withSlashes}`;
  }
  return encoded.replace(/-/g, "/");
}
