import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { getOpenCodeDbPath, openOpenCodeDb } from "./db.ts";
import { BunSqliteLayer } from "./runtime/bun-sqlite.ts";

const testDir = join(tmpdir(), `klovi-opencode-db-test-${Date.now()}`);

const testLayer = Layer.mergeAll(
  NodeFileSystem.layer,
  Layer.succeed(PluginConfig, { dataDir: testDir }),
  BunSqliteLayer,
);

function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

describe("opencode db helpers", () => {
  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("returns db path in configured data directory", async () => {
    const dbPath = await runEffect(getOpenCodeDbPath());
    expect(dbPath).toBe(join(testDir, "opencode.db"));
  });

  test("openOpenCodeDb returns null when db file is missing", async () => {
    const db = await runEffect(openOpenCodeDb());
    expect(db).toBeNull();
  });

  test("openOpenCodeDb returns null when sqlite open throws", async () => {
    await mkdir(join(testDir, "opencode.db"), { recursive: true });
    const db = await runEffect(openOpenCodeDb());
    expect(db).toBeNull();
  });
});
