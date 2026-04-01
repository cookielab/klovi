import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectLinuxSystemTheme,
	ensureDesktopRuntimeDirs,
	getDesktopRuntimeDirs,
	resolveLinuxRenderer,
} from "./linux-runtime.ts";

describe("resolveLinuxRenderer", () => {
	test("defaults to native on Linux", () => {
		expect(resolveLinuxRenderer("linux", {})).toBe("native");
	});

	test("allows CEF override only on Linux", () => {
		expect(resolveLinuxRenderer("linux", { KLOVI_LINUX_RENDERER: "cef" })).toBe("cef");
		expect(resolveLinuxRenderer("darwin", { KLOVI_LINUX_RENDERER: "cef" })).toBeUndefined();
	});
});

describe("detectLinuxSystemTheme", () => {
	test("returns null on non-Linux platforms", async () => {
		expect(await detectLinuxSystemTheme("darwin", {})).toBeNull();
		expect(await detectLinuxSystemTheme("win32", {})).toBeNull();
	});

	test("detects dark from GTK_THEME with -dark suffix", async () => {
		expect(await detectLinuxSystemTheme("linux", { GTK_THEME: "Adwaita-dark" })).toBe("dark");
	});

	test("detects dark from GTK_THEME with :dark variant", async () => {
		expect(await detectLinuxSystemTheme("linux", { GTK_THEME: "Adwaita:dark" })).toBe("dark");
	});

	test("detects light from GTK_THEME without dark", async () => {
		expect(await detectLinuxSystemTheme("linux", { GTK_THEME: "Adwaita" })).toBe("light");
	});
});

describe("desktop runtime directories", () => {
	test("includes user and CEF runtime directories", () => {
		const dirs = getDesktopRuntimeDirs({
			userData: "/tmp/klovi/data",
			userCache: "/tmp/klovi/cache",
			userLogs: "/tmp/klovi/logs",
		});

		expect(dirs).toEqual([
			"/tmp/klovi/data",
			"/tmp/klovi/cache",
			"/tmp/klovi/logs",
			"/tmp/klovi/cache/CEF",
			"/tmp/klovi/cache/CEF/Partitions",
			"/tmp/klovi/cache/CEF/Partitions/default",
		]);
	});

	test("creates all runtime directories", () => {
		const root = mkdtempSync(join(tmpdir(), "klovi-runtime-"));
		const paths = {
			userData: join(root, "data"),
			userCache: join(root, "cache"),
			userLogs: join(root, "logs"),
		};

		ensureDesktopRuntimeDirs(paths);

		for (const dir of getDesktopRuntimeDirs(paths)) {
			expect(existsSync(dir)).toBe(true);
		}
	});
});
