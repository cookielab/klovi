import { join } from "node:path";
import { makeVersionState } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Fiber } from "effect";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import pkg from "../../package.json" with { type: "json" };
import type { KloviRPC } from "../shared/rpc-types.ts";
import { detectLinuxSystemTheme, ensureDesktopRuntimeDirs, resolveLinuxRenderer, type SystemTheme } from "./linux-runtime.ts";
import {
	acceptRisksHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionsHandler,
	getStatsHandler,
	getSubAgentHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
} from "./rpc-handlers.ts";
import { bridgeHandler, makeDesktopRuntime } from "./runtime.ts";
import { makeThemePollingFiber } from "./theme-polling.ts";
import { UpdateManager } from "./updater.ts";

const versionState = makeVersionState(pkg.version ?? "0.0.0", pkg.commit ?? "");

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

const runtime = makeDesktopRuntime({
	versionInfo: versionState,
	settingsPath: settingsPath,
	appDataDir: Utils.paths.userData,
	isLinux: isLinux,
});

function getUpdatePlatform(platform: NodeJS.Platform): "linux" | "macos" | "win" {
	if (platform === "darwin") {
		return "macos";
	}

	if (platform === "win32") {
		return "win";
	}

	return "linux";
}

function getUpdateManager(): UpdateManager {
	if (!updateManager) {
		updateManager = new UpdateManager({
			currentVersion: pkg.version ?? "dev",
			platform: getUpdatePlatform(process.platform),
			arch: process.arch === "arm64" ? "arm64" : "x64",
			settingsPath: settingsPath,
			appDataDir: Utils.paths.userData,
		});
	}
	return updateManager;
}

const getSystemThemeHandler = Effect.gen(function* () {
	const theme = yield* detectLinuxSystemTheme();
	return { theme: theme };
});

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
					return Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: false });
				}
				return getUpdateManager().getSettings();
			},
			updateUpdateSettings: async (params) => {
				if (isLinux) {
					return { channel: "stable" as const, checkIntervalHours: 6, autoDownload: false };
				}
				const result = await getUpdateManager().updateSettings(params);
				await getUpdateManager().restartSchedule();
				return result;
			},
			checkForUpdate: () => {
				if (isLinux) {
					return Promise.resolve({ status: "up-to-date" as const, currentVersion: pkg.version ?? "dev" });
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
			acceptRisks: () => bridgeHandler(runtime, acceptRisksHandler),
			isFirstLaunch: () => bridgeHandler(runtime, isFirstLaunchHandler),
			getVersion: () => bridgeHandler(runtime, getVersionHandler),
			getStats: () => bridgeHandler(runtime, getStatsHandler),
			getProjects: () => bridgeHandler(runtime, getProjectsHandler),
			getSessions: (params) => bridgeHandler(runtime, getSessionsHandler(params)),
			getSession: (params) => bridgeHandler(runtime, getSessionHandler(params)),
			getSubAgent: (params) => bridgeHandler(runtime, getSubAgentHandler(params)),
			searchSessions: () => bridgeHandler(runtime, searchSessionsHandler),
			getPluginSettings: () => bridgeHandler(runtime, getPluginSettingsHandler),
			updatePluginSetting: (params) => bridgeHandler(runtime, updatePluginSettingHandler(params)),
			getGeneralSettings: () => bridgeHandler(runtime, getGeneralSettingsHandler),
			updateGeneralSettings: (params) => bridgeHandler(runtime, updateGeneralSettingsHandler(params)),
			resetSettings: () => bridgeHandler(runtime, resetSettingsHandler),
			getSystemTheme: () => bridgeHandler(runtime, getSystemThemeHandler),
		},
		messages: {},
	},
});

const win = new BrowserWindow({
	title: "Klovi",
	url: "views://main/index.html",
	frame: { x: 0, y: 0, width: 1400, height: 900 },
	...(linuxRenderer ? { renderer: linuxRenderer } : {}),
	rpc: rpc,
});

// Start update checking (skip on Linux — no auto-update support)
if (!isLinux) {
	const mgr = getUpdateManager();
	mgr.setStatusCallback((status) => {
		win.webview.rpc?.send.updateStatus(status);
	});
	await mgr.cleanup();
	await mgr.startSchedule();
}

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

// Start Linux theme polling as an Effect fiber forked on the runtime
let themePollingFiber: Fiber.RuntimeFiber<void, never> | null = null;
if (isLinux) {
	themePollingFiber = runtime.runFork(
		makeThemePollingFiber((theme: SystemTheme) => {
			win.webview.rpc?.send.systemThemeChanged({ theme: theme });
		}),
	);
}

Electrobun.events.on("before-quit", () => {
	if (!isLinux) {
		updateManager?.stopSchedule();
	}
	if (themePollingFiber) {
		Effect.runFork(Fiber.interrupt(themePollingFiber));
	}
	void runtime.dispose();
});
