import { join } from "node:path";
import {
	completeOnboarding,
	getGeneralSettings,
	getPluginSettings,
	getProjects,
	getSession,
	getSessions,
	getStats,
	getSubAgent,
	getUpdateSettings,
	getVersion,
	isFirstLaunch,
	resetSettings,
	searchSessions,
	setVersion,
	updateGeneralSettings,
	updatePluginSetting,
	updateUpdateSettings,
} from "@cookielab.io/klovi-server/services/app-services";
import { createRegistry } from "@cookielab.io/klovi-server/services/auto-discover";
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import { loadSettings } from "@cookielab.io/klovi-server/services/settings";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import pkg from "../../package.json" with { type: "json" };
import type { KloviRPC } from "../shared/rpc-types.ts";
import {
	detectLinuxSystemTheme,
	ensureDesktopRuntimeDirs,
	resolveLinuxRenderer,
	type SystemTheme,
} from "./linux-runtime.ts";
import { UpdateManager } from "./updater.ts";

// Initialize version from package.json
setVersion(pkg.version ?? "0.0.0", pkg.commit ?? "");

const isLinux = process.platform === "linux";
let updateManager: UpdateManager | null = null;

function getSettingsPath(): string {
	const home = Bun.env["HOME"] ?? Bun.env["USERPROFILE"] ?? "";
	return join(home, ".klovi", "settings.json");
}

const settingsPath = getSettingsPath();
ensureDesktopRuntimeDirs({
	userData: Utils.paths.userData,
	userCache: Utils.paths.userCache,
	userLogs: Utils.paths.userLogs,
});
const linuxRenderer = resolveLinuxRenderer();

// Registry lifecycle: created on acceptRisks, refreshed after settings changes
let registry: PluginRegistry | null = null;

async function ensureRegistry(): Promise<PluginRegistry> {
	if (!registry) {
		const settings = await loadSettings(settingsPath);
		registry = await createRegistry(settings);
	}
	return registry;
}

async function refreshRegistry(): Promise<void> {
	const settings = await loadSettings(settingsPath);
	registry = await createRegistry(settings);
}

function getUpdateManager(): UpdateManager {
	if (!updateManager) {
		updateManager = new UpdateManager({
			currentVersion: pkg.version ?? "dev",
			platform: ({ darwin: "macos", win32: "win" } as const)[process.platform] ?? "linux",
			arch: process.arch === "arm64" ? "arm64" : "x64",
			settingsPath: settingsPath,
			appDataDir: Utils.paths.userData,
		});
	}
	return updateManager;
}

// Start update checking (skip on Linux — no auto-update support)
if (!isLinux) {
	const mgr = getUpdateManager();
	mgr.setStatusCallback((status) => {
		win.webview.rpc?.send.updateStatus(status);
	});
	await mgr.cleanup();
	await mgr.startSchedule();
}

// Linux system theme polling (5s interval)
let lastLinuxTheme: SystemTheme | null = null;
let themePollingInterval: ReturnType<typeof setInterval> | null = null;

// Desktop RPC: native host bridge + data methods
const rpc = BrowserView.defineRPC<KloviRPC>({
	handlers: {
		requests: {
			// Native host bridge methods
			browseDirectory: async (params) => {
				const paths = await Utils.openFileDialog({
					startingFolder: params.startingFolder ?? "~/",
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});
				const selected = paths[0];
				return { path: selected && selected !== "" ? selected : null };
			},
			getUpdateSettings: () => {
				if (isLinux) {
					return { channel: "stable" as const, checkIntervalHours: 6, autoDownload: false };
				}
				return getUpdateSettings(settingsPath);
			},
			updateUpdateSettings: async (params) => {
				if (isLinux) {
					return { channel: "stable" as const, checkIntervalHours: 6, autoDownload: false };
				}
				const result = await updateUpdateSettings(settingsPath, params);
				await getUpdateManager().restartSchedule();
				return result;
			},
			checkForUpdate: () => {
				if (isLinux) {
					return { status: "up-to-date" as const, currentVersion: pkg.version ?? "dev" };
				}
				return getUpdateManager().check();
			},
			applyUpdate: async () => {
				if (isLinux) {
					return { ok: false, error: "Auto-update is not supported on Linux" };
				}
				try {
					await getUpdateManager().apply();
					return { ok: true };
				} catch (error) {
					return { ok: false, error: error instanceof Error ? error.message : "Update failed" };
				}
			},
			openExternal: (params) => {
				Utils.openExternal(params.url);
				return { ok: true };
			},

			// Data methods (KloviClient)
			acceptRisks: async () => {
				await completeOnboarding(settingsPath);
				await ensureRegistry();
				return { ok: true };
			},
			isFirstLaunch: () => isFirstLaunch(settingsPath),
			getVersion: () => getVersion(),
			getStats: async () => {
				const reg = await ensureRegistry();
				return getStats(reg);
			},
			getProjects: async () => {
				const reg = await ensureRegistry();
				return getProjects(reg);
			},
			getSessions: async (params) => {
				const reg = await ensureRegistry();
				return getSessions(reg, params);
			},
			getSession: async (params) => {
				const reg = await ensureRegistry();
				return getSession(reg, params);
			},
			getSubAgent: async (params) => {
				const reg = await ensureRegistry();
				return getSubAgent(reg, params);
			},
			searchSessions: async () => {
				const reg = await ensureRegistry();
				return searchSessions(reg);
			},
			getPluginSettings: () => getPluginSettings(settingsPath),
			updatePluginSetting: async (params) => {
				const result = await updatePluginSetting(settingsPath, params);
				await refreshRegistry();
				return result;
			},
			getGeneralSettings: () => getGeneralSettings(settingsPath),
			updateGeneralSettings: (params) => updateGeneralSettings(settingsPath, params),
			resetSettings: async () => {
				const result = await resetSettings(settingsPath);
				await refreshRegistry();
				return result;
			},
			getSystemTheme: async () => {
				const theme = await detectLinuxSystemTheme();
				return { theme: theme };
			},
		},
		messages: {},
	},
});

// Application menu
ApplicationMenu.setApplicationMenu([
	{
		label: "Klovi",
		submenu: [
			{ label: "About Klovi", role: "about" },
			{ type: "separator" },
			{ label: "Preferences...", action: "openSettings", accelerator: "CmdOrCtrl+," },
			...(isLinux ? [] : [{ label: "Check for Updates...", action: "checkForUpdates" }]),
			{ type: "separator" },
			{ label: "Quit Klovi", role: "quit", accelerator: "CmdOrCtrl+q" },
		],
	},
	{
		label: "Edit",
		submenu: [{ role: "copy" }, { role: "selectAll" }],
	},
	{
		label: "View",
		submenu: [
			{ label: "Toggle Theme", action: "cycleTheme", accelerator: "t" },
			{ type: "separator" },
			{ label: "Increase Font Size", action: "increaseFontSize", accelerator: "plus" },
			{ label: "Decrease Font Size", action: "decreaseFontSize", accelerator: "minus" },
			{ type: "separator" },
			{ label: "Toggle Presentation", action: "togglePresentation", accelerator: "p" },
		],
	},
	{
		label: "Window",
		submenu: [{ role: "minimize" }, { role: "zoom" }],
	},
]);

const win = new BrowserWindow({
	title: "Klovi",
	url: "views://main/index.html",
	frame: { x: 0, y: 0, width: 1400, height: 900 },
	...(linuxRenderer ? { renderer: linuxRenderer } : {}),
	rpc: rpc,
});

// Forward menu actions to webview as RPC messages
Electrobun.events.on("application-menu-clicked", (e) => {
	const rpcSend = win.webview.rpc?.send;
	if (!rpcSend) {
		return;
	}
	switch (e.data.action) {
		case "cycleTheme":
			rpcSend.cycleTheme({});
			break;
		case "increaseFontSize":
			rpcSend.increaseFontSize({});
			break;
		case "decreaseFontSize":
			rpcSend.decreaseFontSize({});
			break;
		case "togglePresentation":
			rpcSend.togglePresentation({});
			break;
		case "openSettings":
			rpcSend.openSettings({});
			break;
		case "checkForUpdates":
			if (!isLinux) {
				getUpdateManager()
					.check()
					.then((result) => {
						win.webview.rpc?.send.checkForUpdatesResult(result);
					})
					.catch(() => {});
			}
			break;
	}
});

// Start Linux theme polling after window is created
if (isLinux) {
	themePollingInterval = setInterval(async () => {
		const theme = await detectLinuxSystemTheme();
		if (theme && theme !== lastLinuxTheme) {
			lastLinuxTheme = theme;
			win.webview.rpc?.send.systemThemeChanged({ theme: theme });
		}
	}, 5000);
}

Electrobun.events.on("before-quit", () => {
	if (!isLinux) {
		updateManager?.stopSchedule();
	}
	if (themePollingInterval) {
		clearInterval(themePollingInterval);
	}
});
