import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3583;

type KloviCliConfig = {
	host: string;
	port: number;
	staticDir: string;
	settingsPath?: string | undefined;
	openBrowser: boolean;
};

export function resolveStaticDir(baseDir: string, pathExists: (path: string) => boolean = existsSync): string {
	// Built artifact: __dir = dist/ -> dist/web
	const builtPath = resolve(baseDir, "web");
	if (pathExists(builtPath)) {
		return builtPath;
	}

	// Source dev mode: __dir = src/ -> ../../../packages/ui/dist
	return resolve(baseDir, "../../../packages/ui/dist");
}

export function parsePort(argv: readonly string[], env: Record<string, string | undefined>): number {
	const portArgIndex = argv.indexOf("--port");
	if (portArgIndex !== -1) {
		const value = argv[portArgIndex + 1];
		if (value !== undefined) {
			return Number(value);
		}
	}

	return Number(env["KLOVI_PORT"] ?? String(DEFAULT_PORT));
}

type ResolveCliConfigInput = {
	baseDir: string;
	argv: readonly string[];
	env: Record<string, string | undefined>;
	pathExists?: (path: string) => boolean;
};

export function resolveCliConfig(input: ResolveCliConfigInput): KloviCliConfig {
	const { baseDir, argv, env, pathExists } = input;
	return {
		host: env["KLOVI_HOST"] ?? DEFAULT_HOST,
		port: parsePort(argv, env),
		staticDir: env["KLOVI_STATIC_DIR"] ?? resolveStaticDir(baseDir, pathExists),
		settingsPath: env["KLOVI_SETTINGS_PATH"],
		openBrowser: !argv.includes("--no-browser"),
	};
}
