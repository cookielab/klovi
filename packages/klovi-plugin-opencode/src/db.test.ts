import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getOpenCodeDir, setOpenCodeDir } from "./config.ts";
import { getOpenCodeDbPath, openOpenCodeDb } from "./db.ts";

const testDir = join(tmpdir(), `klovi-opencode-db-test-${Date.now()}`);

describe("opencode db helpers", () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = getOpenCodeDir();
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    setOpenCodeDir(testDir);
  });

  afterEach(() => {
    setOpenCodeDir(originalDir);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("returns db path in configured data directory", () => {
    expect(getOpenCodeDbPath()).toBe(join(testDir, "opencode.db"));
  });

  test("openOpenCodeDb returns null when db file is missing", async () => {
    const db = await openOpenCodeDb();
    expect(db).toBeNull();
  });

  test("openOpenCodeDb returns null when sqlite open throws", async () => {
    mkdirSync(join(testDir, "opencode.db"), { recursive: true });
    const db = await openOpenCodeDb();
    expect(db).toBeNull();
  });
});
