import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parsePort, resolveCliConfig, resolveStaticDir } from "./cli-config.ts";

describe("cli-config", () => {
	const baseDir = resolve(import.meta.dir, "src-under-test");

	test("resolveStaticDir prefers built web assets when present", () => {
		const config = resolveCliConfig(baseDir, ["bun"], {}, (path) => path.endsWith("/web"));
		expect(config.staticDir).toBe(resolve(baseDir, "web"));
	});

	test("resolveStaticDir falls back to workspace UI dist in source mode", () => {
		expect(resolveStaticDir(baseDir, () => false)).toBe(resolve(baseDir, "../../../packages/ui/dist"));
	});

	test("parsePort prefers --port over env", () => {
		expect(parsePort(["bun", "cli.ts", "--port", "4444"], { KLOVI_PORT: "5555" })).toBe(4444);
	});

	test("resolveCliConfig reads host, static dir, and settings env overrides", () => {
		const config = resolveCliConfig(
			baseDir,
			["bun", "cli.ts"],
			{
				KLOVI_HOST: "0.0.0.0",
				KLOVI_PORT: "9999",
				KLOVI_STATIC_DIR: "/tmp/custom-static",
				KLOVI_SETTINGS_PATH: "/tmp/custom-settings.json",
			},
			() => false,
		);

		expect(config.host).toBe("0.0.0.0");
		expect(config.port).toBe(9999);
		expect(config.staticDir).toBe("/tmp/custom-static");
		expect(config.settingsPath).toBe("/tmp/custom-settings.json");
		expect(config.openBrowser).toBe(true);
	});

	test("resolveCliConfig disables browser launch with --no-browser", () => {
		const config = resolveCliConfig(baseDir, ["bun", "cli.ts", "--no-browser"], {}, () => false);
		expect(config.openBrowser).toBe(false);
	});
});
