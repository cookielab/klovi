import { resolve } from "node:path";
import { parsePort, resolveCliConfig, resolveStaticDir } from "./cli-config";


const N_4444 = 4444;
const N_9999 = 9999;

describe("cli-config", () => {
	const baseDir = resolve(import.meta.dir, "src-under-test");

	it("resolveStaticDir prefers built web assets when present", () => {
		const config = resolveCliConfig({
			baseDir: baseDir,
			argv: ["bun"],
			env: {},
			pathExists: (path) => path.endsWith("/web"),
		});
		expect(config.staticDir).toBe(resolve(baseDir, "web"));
	});

	it("resolveStaticDir falls back to workspace UI dist in source mode", () => {
		expect(resolveStaticDir(baseDir, () => false)).toBe(resolve(baseDir, "../../../packages/ui/dist"));
	});

	it("parsePort prefers --port over env", () => {
		expect(parsePort(["bun", "cli.ts", "--port", "4444"], { KLOVI_PORT: "5555" })).toBe(N_4444);
	});

	it("resolveCliConfig reads host, static dir, and settings env overrides", () => {
		const config = resolveCliConfig({
			baseDir: baseDir,
			argv: ["bun", "cli.ts"],
			env: {
				KLOVI_HOST: "0.0.0.0",
				KLOVI_PORT: "9999",
				KLOVI_STATIC_DIR: "/tmp/custom-static",
				KLOVI_SETTINGS_PATH: "/tmp/custom-settings.json",
			},
			pathExists: () => false,
		});

		expect(config.host).toBe("0.0.0.0");
		expect(config.port).toBe(N_9999);
		expect(config.staticDir).toBe("/tmp/custom-static");
		expect(config.settingsPath).toBe("/tmp/custom-settings.json");
		expect(config.openBrowser).toBe(true);
	});

	it("resolveCliConfig disables browser launch with --no-browser", () => {
		const config = resolveCliConfig({
			baseDir: baseDir,
			argv: ["bun", "cli.ts", "--no-browser"],
			env: {},
			pathExists: () => false,
		});
		expect(config.openBrowser).toBe(false);
	});
});
