import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import {
	detectLinuxSystemTheme,
	ensureDesktopRuntimeDirs,
	getDesktopRuntimeDirs,
	resolveLinuxRenderer,
} from "./linux-runtime";

const runDetect = (platform: NodeJS.Platform, env: Record<string, string | undefined>) =>
	Effect.runPromise(detectLinuxSystemTheme(platform, env).pipe(Effect.provide(BunContext.layer)));

describe("resolveLinuxRenderer", () => {
	it("defaults to native on Linux", () => {
		expect(resolveLinuxRenderer("linux", {})).toBe("native");
	});

	it("allows CEF override only on Linux", () => {
		expect(resolveLinuxRenderer("linux", { KLOVI_LINUX_RENDERER: "cef" })).toBe("cef");
		expect(resolveLinuxRenderer("darwin", { KLOVI_LINUX_RENDERER: "cef" })).toBeUndefined();
	});
});

describe("detectLinuxSystemTheme", () => {
	it("returns null on non-Linux platforms", async () => {
		expect(await runDetect("darwin", {})).toBeNull();
		expect(await runDetect("win32", {})).toBeNull();
	});

	it("detects dark from GTK_THEME with -dark suffix", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita-dark" })).toBe("dark");
	});

	it("detects dark from GTK_THEME with :dark variant", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita:dark" })).toBe("dark");
	});

	it("detects light from GTK_THEME without dark", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita" })).toBe("light");
	});
});

describe("desktop runtime directories", () => {
	it("includes user and CEF runtime directories", () => {
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

	it("creates all runtime directories", () => {
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
