import { join } from "node:path";
import { makeVersionState } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Fiber, Schedule, SubscriptionRef } from "effect";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import pkg from "../../package.json" with { type: "json" };
import type { KloviRPC, UpdateStatus } from "../shared/rpc-types.ts";
import { detectLinuxSystemTheme, ensureDesktopRuntimeDirs, resolveLinuxRenderer, type SystemTheme } from "./linux-runtime.ts";
import {
	acceptRisksHandler,
	applyUpdateHandler,
	checkForUpdateHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionsHandler,
	getStatsHandler,
	getSubAgentHandler,
	getUpdateSettingsHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
	updateUpdateSettingsHandler,
} from "./rpc-handlers.ts";
import { bridgeHandler, makeDesktopRuntime } from "./runtime.ts";
import { makeThemePollingFiber } from "./theme-polling.ts";
import { cleanupUpdates, startUpdateSchedule } from "./updater-service.ts";
import { UpdateStatusRef } from "./services.ts";

const versionState = makeVersionState(pkg.version ?? "0.0.0", pkg.commit ?? "");

const isLinux = process.platform === "linux";

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

const runtimePlatform: "macos" | "linux" | "win" =
	process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux";
const runtimeArch: "arm64" | "x64" = process.arch === "arm64" ? "arm64" : "x64";

const runtime = makeDesktopRuntime({
	versionInfo: versionState,
	settingsPath: settingsPath,
	appDataDir: Utils.paths.userData,
	isLinux: isLinux,
	currentVersion: pkg.version ?? "dev",
	platform: runtimePlatform,
	arch: runtimeArch,
});

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
				return bridgeHandler(runtime, getUpdateSettingsHandler);
			},
			updateUpdateSettings: (params) => {
				if (isLinux) {
					return Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: false });
				}
				return bridgeHandler(runtime, updateUpdateSettingsHandler(params));
			},
			checkForUpdate: () => {
				if (isLinux) {
					return Promise.resolve({ status: "up-to-date" as const, currentVersion: pkg.version ?? "dev" });
				}
				return bridgeHandler(runtime, checkForUpdateHandler);
			},
			applyUpdate: () => {
				if (isLinux) {
					return Promise.resolve({ ok: false, error: "Auto-update is not supported on Linux" });
				}
				return bridgeHandler(runtime, applyUpdateHandler);
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

// Subscribe to update status changes and forward to webview
if (!isLinux) {
	runtime.runFork(
		Effect.gen(function* () {
			const ref = yield* UpdateStatusRef;
			let lastStatus: UpdateStatus | null = null;
			yield* Effect.schedule(
				Effect.gen(function* () {
					const current = yield* SubscriptionRef.get(ref);
					if (lastStatus === null || current.status !== lastStatus.status || current.progress !== lastStatus.progress) {
						lastStatus = current;
						win.webview.rpc?.send.updateStatus(current);
					}
				}),
				Schedule.spaced("500 millis"),
			);
		}),
	);
}

// Start update checking (skip on Linux — no auto-update support)
let updateScheduleFiber: Fiber.RuntimeFiber<void, never> | null = null;
if (!isLinux) {
	await bridgeHandler(runtime, cleanupUpdates);
	updateScheduleFiber = runtime.runFork(startUpdateSchedule(true));
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
				bridgeHandler(runtime, checkForUpdateHandler)
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
	if (updateScheduleFiber) {
		Effect.runFork(Fiber.interrupt(updateScheduleFiber));
	}
	if (themePollingFiber) {
		Effect.runFork(Fiber.interrupt(themePollingFiber));
	}
	void runtime.dispose();
});
