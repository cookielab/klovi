import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeEncodedPath,
  getLatestMtime,
  listFilesBySuffix,
  listFilesWithMtime,
  readDirEntriesSafe,
  readTextPrefix,
} from "./discovery-utils.ts";

const testDir = join(tmpdir(), `klovi-claude-discovery-utils-test-${Date.now()}`);
const originalPlatform = process.platform;

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform });
  rmSync(testDir, { recursive: true, force: true });
});

describe("claude discovery utils", () => {
  test("readDirEntriesSafe returns [] for missing directory", async () => {
    const entries = await readDirEntriesSafe(join(testDir, "missing"));
    expect(entries).toEqual([]);
  });

  test("listFilesBySuffix filters matching files", async () => {
    writeFileSync(join(testDir, "a.jsonl"), "{}");
    writeFileSync(join(testDir, "b.txt"), "x");
    writeFileSync(join(testDir, "c.jsonl"), "{}");

    const files = await listFilesBySuffix(testDir, ".jsonl");
    expect(files.sort()).toEqual(["a.jsonl", "c.jsonl"]);
  });

  test("getLatestMtime returns newest mtime and tolerates missing file", async () => {
    const first = join(testDir, "a.jsonl");
    const second = join(testDir, "b.jsonl");

    writeFileSync(first, "{}");
    writeFileSync(second, "{}");
    utimesSync(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
    utimesSync(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

    const latest = await getLatestMtime(testDir, ["missing.jsonl", "a.jsonl", "b.jsonl"]);
    expect(latest).toBe("2025-01-15T00:00:00.000Z");
  });

  test("listFilesWithMtime returns descending mtime order", async () => {
    const first = join(testDir, "a.jsonl");
    const second = join(testDir, "b.jsonl");

    writeFileSync(first, "{}");
    writeFileSync(second, "{}");
    utimesSync(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
    utimesSync(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

    const files = await listFilesWithMtime(testDir, ".jsonl");
    expect(files.map((f) => f.fileName)).toEqual(["b.jsonl", "a.jsonl"]);
  });

  test("readTextPrefix reads only requested prefix length", async () => {
    const filePath = join(testDir, "sample.txt");
    writeFileSync(filePath, "abcdef");

    const prefix = await readTextPrefix(filePath, 3);
    expect(prefix).toBe("abc");
  });

  test("decodeEncodedPath decodes unix-style encoded paths", () => {
    expect(decodeEncodedPath("-Users-dev-project")).toBe("/Users/dev/project");
    expect(decodeEncodedPath("Users-dev-project")).toBe("Users/dev/project");
  });

  test("decodeEncodedPath decodes windows drive format when running on win32", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(decodeEncodedPath("-C-Users-dev-project")).toBe("C:/Users/dev/project");
  });
});
