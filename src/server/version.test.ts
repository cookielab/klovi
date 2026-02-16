import { describe, expect, test } from "bun:test";
import { appVersion } from "./version.ts";

describe("appVersion", () => {
  test("has version property", () => {
    expect(appVersion.version).toBeDefined();
    expect(typeof appVersion.version).toBe("string");
  });

  test("has commitHash property (string or null)", () => {
    expect("commitHash" in appVersion).toBe(true);
    if (appVersion.commitHash !== null) {
      expect(typeof appVersion.commitHash).toBe("string");
    }
  });
});
