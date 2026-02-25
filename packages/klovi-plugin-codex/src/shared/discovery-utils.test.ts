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

const testDir = join(tmpdir(), `klovi-codex-discovery-utils-test-${Date.now()}`);
const originalPlatform = process.platform;

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform });
  rmSync(testDir, { recursive: true, force: true });
});

describe("codex discovery utils", () => {
  test("readDirEntriesSafe returns [] for missing directory", async () => {
    const entries = await readDirEntriesSafe(join(testDir, "missing"));
    expect(entries).toEqual([]);
  });

  test("listFilesBySuffix filters matching files", async () => {
    writeFileSync(join(testDir, "a.jsonl"), "{}");
    writeFileSync(join(testDir, "b.txt"), "x");

    const files = await listFilesBySuffix(testDir, ".jsonl");
    expect(files).toEqual(["a.jsonl"]);
  });

  test("getLatestMtime returns newest mtime and ignores missing files", async () => {
    const first = join(testDir, "a.jsonl");
    const second = join(testDir, "b.jsonl");

    writeFileSync(first, "{}");
    writeFileSync(second, "{}");
    utimesSync(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
    utimesSync(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

    const latest = await getLatestMtime(testDir, ["a.jsonl", "missing.jsonl", "b.jsonl"]);
    expect(latest).toBe("2025-01-15T00:00:00.000Z");
  });

  test("listFilesWithMtime returns files sorted by descending mtime", async () => {
    const first = join(testDir, "a.jsonl");
    const second = join(testDir, "b.jsonl");

    writeFileSync(first, "{}");
    writeFileSync(second, "{}");
    utimesSync(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
    utimesSync(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

    const files = await listFilesWithMtime(testDir, ".jsonl");
    expect(files.map((f) => f.fileName)).toEqual(["b.jsonl", "a.jsonl"]);
  });

  test("readTextPrefix reads only requested bytes", async () => {
    const filePath = join(testDir, "sample.txt");
    writeFileSync(filePath, "abcdef");

    const prefix = await readTextPrefix(filePath, 4);
    expect(prefix).toBe("abcd");
  });

  test("decodeEncodedPath supports unix-style paths", () => {
    expect(decodeEncodedPath("-Users-dev-project")).toBe("/Users/dev/project");
    expect(decodeEncodedPath("Users-dev-project")).toBe("Users/dev/project");
  });

  test("decodeEncodedPath supports windows-style drive paths", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(decodeEncodedPath("-D-Workspace-klovi")).toBe("D:/Workspace/klovi");
  });
});
