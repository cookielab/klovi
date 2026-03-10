import { describe, expect, test } from "bun:test";
import {
  getExpectedBundleName,
  parseArgs,
  parseTarEntries,
} from "./verify-macos-wrapper-contract.ts";

describe("parseArgs", () => {
  test("parses required app path", () => {
    const result = parseArgs([
      "bun",
      "verify-macos-wrapper-contract.ts",
      "build/beta-macos-arm64/Klovi.app",
    ]);
    expect(result).toEqual({
      appPath: "build/beta-macos-arm64/Klovi.app",
    });
  });

  test("parses optional zstd path", () => {
    const result = parseArgs([
      "bun",
      "verify-macos-wrapper-contract.ts",
      "build/beta-macos-arm64/Klovi.app",
      "--zstd",
      "apps/desktop/node_modules/electrobun/dist-macos-arm64/zig-zstd",
    ]);
    expect(result).toEqual({
      appPath: "build/beta-macos-arm64/Klovi.app",
      zstdPath: "apps/desktop/node_modules/electrobun/dist-macos-arm64/zig-zstd",
    });
  });
});

describe("getExpectedBundleName", () => {
  test("keeps stable builds unsuffixed", () => {
    expect(getExpectedBundleName("Klovi", "stable")).toBe("Klovi.app");
  });

  test("uses channel suffix for non-stable names", () => {
    expect(getExpectedBundleName("Klovi", "beta")).toBe("Klovi-beta.app");
  });
});

describe("parseTarEntries", () => {
  test("parses tar output and strips blanks", () => {
    expect(parseTarEntries("Klovi.app/\nKlovi.app/Contents/\n\n")).toEqual([
      "Klovi.app/",
      "Klovi.app/Contents/",
    ]);
  });
});
