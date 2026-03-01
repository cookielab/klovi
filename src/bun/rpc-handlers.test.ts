import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getUpdateSettings, getVersion, updateUpdateSettings } from "./rpc-handlers.ts";

describe("rpc-handlers", () => {
  test("getVersion returns version info", () => {
    const result = getVersion();
    expect(result).toHaveProperty("version");
    expect(typeof result.version).toBe("string");
    expect(result).toHaveProperty("commit");
    expect(typeof result.commit).toBe("string");
  });
});

const testDir = join(tmpdir(), `klovi-rpc-test-${Date.now()}`);

describe("update settings handlers", () => {
  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true });
    } catch {}
  });

  test("getUpdateSettings returns defaults when no settings exist", () => {
    const path = join(testDir, "nonexistent", "settings.json");
    const result = getUpdateSettings(path);
    expect(result.channel).toBe("stable");
    expect(result.checkIntervalHours).toBe(6);
    expect(result.autoDownload).toBe(true);
  });

  test("updateUpdateSettings persists channel change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { channel: "beta" });
    expect(result.channel).toBe("beta");
    const reloaded = getUpdateSettings(path);
    expect(reloaded.channel).toBe("beta");
  });

  test("updateUpdateSettings persists checkIntervalHours change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { checkIntervalHours: 1 });
    expect(result.checkIntervalHours).toBe(1);
  });

  test("updateUpdateSettings persists autoDownload change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { autoDownload: false });
    expect(result.autoDownload).toBe(false);
  });
});
