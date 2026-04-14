import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Command, type CommandExecutor } from "@effect/platform";
import { Effect } from "effect";

type BrowserRenderer = "native" | "cef";
type SystemTheme = "dark" | "light";

const DARK_SUFFIX_RE = /-dark/iu;
const DARK_VARIANT_RE = /:dark/iu;
const DARK_RE = /dark/iu;

type DesktopRuntimePaths = {
	userData: string;
	userCache: string;
	userLogs: string;
};

function resolveLinuxRenderer(
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): BrowserRenderer | undefined {
	if (platform !== "linux") {
		return;
	}
	return env["KLOVI_LINUX_RENDERER"] === "cef" ? "cef" : "native";
}

function getDesktopRuntimeDirs(paths: DesktopRuntimePaths): string[] {
	const cefDir = join(paths.userCache, "CEF");
	const partitionsDir = join(cefDir, "Partitions");
	return [paths.userData, paths.userCache, paths.userLogs, cefDir, partitionsDir, join(partitionsDir, "default")];
}

function ensureDesktopRuntimeDirs(paths: DesktopRuntimePaths): void {
	for (const dir of getDesktopRuntimeDirs(paths)) {
		mkdirSync(dir, { recursive: true });
	}
}

const runGsettings = (key: string): Effect.Effect<string | null, never, CommandExecutor.CommandExecutor> =>
	Command.make("gsettings", "get", "org.gnome.desktop.interface", key).pipe(
		Command.string,
		Effect.map((out) => out.trim()),
		Effect.catchAll(() => Effect.succeed<string | null>(null)),
	);

const themeFromColorScheme = (colorScheme: string): SystemTheme | null => {
	if (colorScheme.includes("prefer-dark")) {
		return "dark";
	}
	if (colorScheme.includes("prefer-light") || colorScheme.includes("default")) {
		return "light";
	}
	return null;
};

const themeFromGtkThemeEnv = (gtkThemeEnv: string): SystemTheme => {
	if (DARK_SUFFIX_RE.test(gtkThemeEnv) || DARK_VARIANT_RE.test(gtkThemeEnv)) {
		return "dark";
	}
	return "light";
};

const themeFromGtkThemeName = (gtkTheme: string): SystemTheme => (DARK_RE.test(gtkTheme) ? "dark" : "light");

const detectLinuxSystemTheme = (
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): Effect.Effect<SystemTheme | null, never, CommandExecutor.CommandExecutor> =>
	Effect.gen(function* () {
		if (platform !== "linux") {
			return null;
		}

		// 1. GNOME 42+ color-scheme setting
		const colorScheme = yield* runGsettings("color-scheme");
		if (colorScheme !== null) {
			const theme = themeFromColorScheme(colorScheme);
			if (theme !== null) {
				return theme;
			}
		}

		// 2. GTK_THEME environment variable
		const gtkThemeEnv = env["GTK_THEME"];
		if (gtkThemeEnv) {
			return themeFromGtkThemeEnv(gtkThemeEnv);
		}

		// 3. GNOME gtk-theme setting
		const gtkTheme = yield* runGsettings("gtk-theme");
		if (gtkTheme !== null) {
			return themeFromGtkThemeName(gtkTheme);
		}

		return null;
	});

export type { BrowserRenderer, SystemTheme };
export { detectLinuxSystemTheme, ensureDesktopRuntimeDirs, getDesktopRuntimeDirs, resolveLinuxRenderer };
