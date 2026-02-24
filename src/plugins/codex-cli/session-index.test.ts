import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setCodexCliDir } from "../config.ts";
import {
  findCodexSessionFileById,
  isCodexSessionMeta,
  normalizeSessionMeta,
  scanCodexSessions,
} from "./session-index.ts";

const testDir = join(tmpdir(), `klovi-codex-session-index-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(join(testDir, "sessions"), { recursive: true });
  setCodexCliDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("isCodexSessionMeta", () => {
  test("returns true for valid old-format meta", () => {
    expect(
      isCodexSessionMeta({
        uuid: "test",
        cwd: "/tmp",
        timestamps: { created: 1000, updated: 2000 },
        model: "o4-mini",
        provider_id: "openai",
      }),
    ).toBe(true);
  });

  test("returns false for new-format envelope", () => {
    expect(
      isCodexSessionMeta({
        type: "session_meta",
        payload: { id: "test", cwd: "/tmp" },
      }),
    ).toBe(false);
  });

  test("returns false for non-object", () => {
    expect(isCodexSessionMeta("string")).toBe(false);
    expect(isCodexSessionMeta(null)).toBe(false);
  });
});

describe("normalizeSessionMeta", () => {
  test("passes through old-format meta unchanged", () => {
    const meta = {
      uuid: "old-uuid",
      cwd: "/tmp/project",
      timestamps: { created: 1706000000, updated: 1706001000 },
      model: "o4-mini",
      provider_id: "openai",
    };
    const result = normalizeSessionMeta(meta);
    expect(result).toEqual(meta);
  });

  test("normalizes new-format envelope to CodexSessionMeta", () => {
    const newFormat = {
      type: "session_meta",
      timestamp: "2026-02-18T10:00:00.000Z",
      payload: {
        id: "new-uuid",
        cwd: "/tmp/project",
        timestamp: "2026-02-18T10:00:00.000Z",
        model_provider: "openai",
        model: "o4-mini",
      },
    };

    const result = normalizeSessionMeta(newFormat);

    expect(result).not.toBeNull();
    expect(result!.uuid).toBe("new-uuid");
    expect(result!.cwd).toBe("/tmp/project");
    expect(result!.model).toBe("o4-mini");
    expect(result!.provider_id).toBe("openai");
    expect(result!.timestamps.created).toBeCloseTo(
      new Date("2026-02-18T10:00:00.000Z").getTime() / 1000,
      0,
    );
  });

  test("uses model_provider as model when model absent", () => {
    const newFormat = {
      type: "session_meta",
      payload: {
        id: "uuid",
        cwd: "/tmp",
        timestamp: "2026-02-18T10:00:00.000Z",
        model_provider: "anthropic",
      },
    };

    const result = normalizeSessionMeta(newFormat);
    expect(result!.model).toBe("anthropic");
    expect(result!.provider_id).toBe("anthropic");
  });

  test("uses file mtime as updated timestamp", () => {
    const newFormat = {
      type: "session_meta",
      payload: {
        id: "uuid",
        cwd: "/tmp",
        timestamp: "2026-02-18T10:00:00.000Z",
        model_provider: "openai",
      },
    };

    const fileMtime = 1800000000;
    const result = normalizeSessionMeta(newFormat, fileMtime);
    expect(result!.timestamps.updated).toBe(fileMtime);
  });

  test("returns null for unrecognized format", () => {
    expect(normalizeSessionMeta({ random: "object" })).toBeNull();
    expect(normalizeSessionMeta("string")).toBeNull();
    expect(normalizeSessionMeta(null)).toBeNull();
  });
});

describe("findCodexSessionFileById", () => {
  test("finds old-format file by exact uuid match", async () => {
    const dir = join(testDir, "sessions", "openai", "2025-01-15");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "my-uuid.jsonl"), "{}");

    const result = await findCodexSessionFileById("my-uuid");
    expect(result).toBe(join(dir, "my-uuid.jsonl"));
  });

  test("finds new-format file by suffix match", async () => {
    const dir = join(testDir, "sessions", "2026", "02", "18");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "rollout-2026-02-18-my-uuid.jsonl"), "{}");

    const result = await findCodexSessionFileById("my-uuid");
    expect(result).toBe(join(dir, "rollout-2026-02-18-my-uuid.jsonl"));
  });

  test("returns null when no file matches", async () => {
    const result = await findCodexSessionFileById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("scanCodexSessions", () => {
  test("scans new-format session files", async () => {
    const dir = join(testDir, "sessions", "2026", "02", "18");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "rollout-2026-02-18-scan-uuid.jsonl"),
      JSON.stringify({
        type: "session_meta",
        timestamp: "2026-02-18T10:00:00.000Z",
        payload: {
          id: "scan-uuid",
          cwd: "/tmp/project",
          timestamp: "2026-02-18T10:00:00.000Z",
          model_provider: "openai",
          model: "o4-mini",
        },
      }),
    );

    const sessions = await scanCodexSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.meta.uuid).toBe("scan-uuid");
    expect(sessions[0]!.meta.cwd).toBe("/tmp/project");
    expect(sessions[0]!.meta.model).toBe("o4-mini");
  });
});
