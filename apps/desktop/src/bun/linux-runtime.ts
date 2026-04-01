import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type BrowserRenderer = "native" | "cef";
export type SystemTheme = "dark" | "light";

const DARK_SUFFIX_RE = /-dark/iu;
const DARK_VARIANT_RE = /:dark/iu;
const DARK_RE = /dark/iu;

type DesktopRuntimePaths = {
	userData: string;
	userCache: string;
	userLogs: string;
};

export function resolveLinuxRenderer(
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): BrowserRenderer | undefined {
	if (platform !== "linux") {
		return;
	}

	return env["KLOVI_LINUX_RENDERER"] === "cef" ? "cef" : "native";
}

export function getDesktopRuntimeDirs(paths: DesktopRuntimePaths): string[] {
	const cefDir = join(paths.userCache, "CEF");
	const partitionsDir = join(cefDir, "Partitions");

	return [paths.userData, paths.userCache, paths.userLogs, cefDir, partitionsDir, join(partitionsDir, "default")];
}

export function ensureDesktopRuntimeDirs(paths: DesktopRuntimePaths): void {
	for (const dir of getDesktopRuntimeDirs(paths)) {
		mkdirSync(dir, { recursive: true });
	}
}

export async function detectLinuxSystemTheme(
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): Promise<SystemTheme | null> {
	if (platform !== "linux") {
		return null;
	}

	// 1. GNOME 42+ color-scheme setting
	try {
		const result = await Bun.$`gsettings get org.gnome.desktop.interface color-scheme`.text().then((t) => t.trim());
		if (result.includes("prefer-dark")) {
			return "dark";
		}
		if (result.includes("prefer-light") || result.includes("default")) {
			return "light";
		}
	} catch {
		// gsettings not available or schema not found
	}

	// 2. GTK_THEME environment variable
	const gtkThemeEnv = env["GTK_THEME"];
	if (gtkThemeEnv) {
		if (DARK_SUFFIX_RE.test(gtkThemeEnv) || DARK_VARIANT_RE.test(gtkThemeEnv)) {
			return "dark";
		}
		return "light";
	}

	// 3. GNOME gtk-theme setting
	try {
		const result = await Bun.$`gsettings get org.gnome.desktop.interface gtk-theme`.text().then((t) => t.trim());
		if (DARK_RE.test(result)) {
			return "dark";
		}
		return "light";
	} catch {
		// gsettings not available
	}

	return null;
}
