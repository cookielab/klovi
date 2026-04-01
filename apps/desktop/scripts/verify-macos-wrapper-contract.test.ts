import { describe, expect, test } from "bun:test";
import { getExpectedBundleName, parseArgs, parseTarEntries } from "./verify-macos-wrapper-contract.ts";

describe("parseArgs", () => {
	test("parses required app path", () => {
		const result = parseArgs(["bun", "verify-macos-wrapper-contract.ts", "build/stable-macos-arm64/Klovi.app"]);
		expect(result).toEqual({
			appPath: "build/stable-macos-arm64/Klovi.app",
		});
	});

	test("parses optional zstd path", () => {
		const result = parseArgs([
			"bun",
			"verify-macos-wrapper-contract.ts",
			"build/stable-macos-arm64/Klovi.app",
			"--zstd",
			"apps/desktop/node_modules/electrobun/dist-macos-arm64/zig-zstd",
		]);
		expect(result).toEqual({
			appPath: "build/stable-macos-arm64/Klovi.app",
			zstdPath: "apps/desktop/node_modules/electrobun/dist-macos-arm64/zig-zstd",
		});
	});
});

describe("getExpectedBundleName", () => {
	test("always expects a stable app bundle name", () => {
		expect(getExpectedBundleName("Klovi")).toBe("Klovi.app");
	});
});

describe("parseTarEntries", () => {
	test("parses tar output and strips blanks", () => {
		expect(parseTarEntries("Klovi.app/\nKlovi.app/Contents/\n\n")).toEqual(["Klovi.app/", "Klovi.app/Contents/"]);
	});
});
