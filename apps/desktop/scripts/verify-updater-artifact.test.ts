import { describe, expect, test } from "bun:test";
import { getDefaultZstdPaths, parseArgs } from "./verify-updater-artifact.ts";

describe("parseArgs", () => {
	test("parses required updater artifact arguments", () => {
		expect(
			parseArgs([
				"bun",
				"verify-updater-artifact.ts",
				"--platform",
				"macos",
				"--arch",
				"arm64",
				"--version",
				"3.0.0-rc.1",
				"--tarball",
				"apps/desktop/artifacts/stable-macos-arm64-Klovi.app.tar.zst",
				"--update-json",
				"apps/desktop/artifacts/stable-macos-arm64-update.json",
			]),
		).toEqual({
			platform: "macos",
			arch: "arm64",
			version: "3.0.0-rc.1",
			tarballPath: "apps/desktop/artifacts/stable-macos-arm64-Klovi.app.tar.zst",
			updateJsonPath: "apps/desktop/artifacts/stable-macos-arm64-update.json",
		});
	});

	test("parses optional zstd path", () => {
		expect(
			parseArgs([
				"bun",
				"verify-updater-artifact.ts",
				"--platform",
				"win",
				"--arch",
				"x64",
				"--version",
				"3.0.0",
				"--tarball",
				"apps/desktop/artifacts/stable-win-x64-Klovi.tar.zst",
				"--update-json",
				"apps/desktop/artifacts/stable-win-x64-update.json",
				"--zstd",
				"node_modules/electrobun/dist-win-x64/zig-zstd.exe",
			]),
		).toEqual({
			platform: "win",
			arch: "x64",
			version: "3.0.0",
			tarballPath: "apps/desktop/artifacts/stable-win-x64-Klovi.tar.zst",
			updateJsonPath: "apps/desktop/artifacts/stable-win-x64-update.json",
			zstdPath: "node_modules/electrobun/dist-win-x64/zig-zstd.exe",
		});
	});
});

describe("getDefaultZstdPaths", () => {
	test("checks desktop and workspace node_modules candidates", () => {
		expect(getDefaultZstdPaths("linux", "arm64")).toEqual([
			expect.stringContaining("apps/desktop/node_modules/electrobun/dist-linux-arm64/zig-zstd"),
			expect.stringContaining("node_modules/electrobun/dist-linux-arm64/zig-zstd"),
		]);
	});

	test("uses .exe suffix for windows", () => {
		expect(getDefaultZstdPaths("win", "x64")).toEqual([
			expect.stringContaining("apps/desktop/node_modules/electrobun/dist-win-x64/zig-zstd.exe"),
			expect.stringContaining("node_modules/electrobun/dist-win-x64/zig-zstd.exe"),
		]);
	});
});
