import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getOpenCodeDir, setOpenCodeDir } from "./config.ts";
import { getOpenCodeDbPath, openOpenCodeDb } from "./db.ts";

const testDir = join(tmpdir(), `klovi-opencode-db-test-${Date.now()}`);

describe("opencode db helpers", () => {
  let originalDir: string;

  beforeEach(async () => {
    originalDir = getOpenCodeDir();
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    setOpenCodeDir(testDir);
  });

  afterEach(async () => {
    setOpenCodeDir(originalDir);
    await rm(testDir, { recursive: true, force: true });
  });

  test("returns db path in configured data directory", () => {
    expect(getOpenCodeDbPath()).toBe(join(testDir, "opencode.db"));
  });

  test("openOpenCodeDb returns null when db file is missing", async () => {
    const db = await openOpenCodeDb();
    expect(db).toBeNull();
  });

  test("openOpenCodeDb returns null when sqlite open throws", async () => {
    await mkdir(join(testDir, "opencode.db"), { recursive: true });
    const db = await openOpenCodeDb();
    expect(db).toBeNull();
  });
});
