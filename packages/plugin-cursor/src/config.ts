import { posix, win32 } from "node:path";
import process from "node:process";

const LEADING_SLASHES_REGEX = /^\/+/u;
const PATH_SEPARATOR_REGEX = /[:/\\]/gu;

type CursorPathOptions = {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
};

function getPlatform(options?: CursorPathOptions): NodeJS.Platform {
	return options?.platform ?? process.platform;
}

function getEnv(options?: CursorPathOptions): NodeJS.ProcessEnv {
	return options?.env ?? Bun.env;
}

function getPathApi(platform: NodeJS.Platform) {
	return platform === "win32" ? win32 : posix;
}

function getHomeDir(options?: CursorPathOptions): string {
	const platform = getPlatform(options);
	const env = getEnv(options);
	if (platform === "win32") {
		return env["USERPROFILE"] ?? env["HOME"] ?? "";
	}
	return env["HOME"] ?? env["USERPROFILE"] ?? "";
}

function getDefaultCursorDir(options?: CursorPathOptions): string {
	const platform = getPlatform(options);
	return getPathApi(platform).join(getHomeDir(options), ".cursor");
}

function getCursorAppSupportRoot(options?: CursorPathOptions): string {
	const platform = getPlatform(options);
	const env = getEnv(options);
	const pathApi = getPathApi(platform);

	if (platform === "darwin") {
		return pathApi.join(getHomeDir(options), "Library", "Application Support", "Cursor");
	}

	if (platform === "win32") {
		const appData = env["APPDATA"] ?? pathApi.join(getHomeDir(options), "AppData", "Roaming");
		return pathApi.join(appData, "Cursor");
	}

	const xdgConfigHome = env["XDG_CONFIG_HOME"] ?? pathApi.join(getHomeDir(options), ".config");
	return pathApi.join(xdgConfigHome, "Cursor");
}

function getCursorGlobalDbPath(options?: CursorPathOptions): string {
	const platform = getPlatform(options);
	return getPathApi(platform).join(getCursorAppSupportRoot(options), "User", "globalStorage", "state.vscdb");
}

function getCursorWorkspaceStorageDir(options?: CursorPathOptions): string {
	const platform = getPlatform(options);
	return getPathApi(platform).join(getCursorAppSupportRoot(options), "User", "workspaceStorage");
}

function encodeCursorProjectPath(projectPath: string): string {
	return projectPath.replace(LEADING_SLASHES_REGEX, "").replace(PATH_SEPARATOR_REGEX, "-");
}

const DEFAULT_CURSOR_DIR = getDefaultCursorDir();

let cursorDir = DEFAULT_CURSOR_DIR;

function getCursorDir(): string {
	return cursorDir;
}

function setCursorDir(dir: string): void {
	cursorDir = dir;
}

export type { CursorPathOptions };
export {
	DEFAULT_CURSOR_DIR,
	encodeCursorProjectPath,
	getCursorAppSupportRoot,
	getCursorDir,
	getCursorGlobalDbPath,
	getCursorWorkspaceStorageDir,
	getDefaultCursorDir,
	setCursorDir,
};
