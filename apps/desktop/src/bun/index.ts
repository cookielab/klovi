import { join } from "node:path";
import { BunPluginLayer } from "@cookielab.io/klovi-server/effect/platform-bun";
import { createRegistry } from "@cookielab.io/klovi-server/services/auto-discover";
import {
	completeOnboarding as completeOnboardingEffect,
	isFirstLaunch as isFirstLaunchEffect,
	resetSettings as resetSettingsEffect,
} from "@cookielab.io/klovi-server/services/onboarding-service";
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import {
	getProjects as getProjectsEffect,
	getSession as getSessionEffect,
	getSessions as getSessionsEffect,
	getSubAgent as getSubAgentEffect,
	searchSessions as searchSessionsEffect,
} from "@cookielab.io/klovi-server/services/sessions-service";
import { loadSettings as loadSettingsEffect } from "@cookielab.io/klovi-server/services/settings";
import {
	getGeneralSettings as getGeneralSettingsEffect,
	getPluginSettings as getPluginSettingsEffect,
	getUpdateSettings as getUpdateSettingsEffect,
	updateGeneralSettings as updateGeneralSettingsEffect,
	updatePluginSetting as updatePluginSettingEffect,
	updateUpdateSettings as updateUpdateSettingsEffect,
} from "@cookielab.io/klovi-server/services/settings-service";
import { getStats as getStatsEffect } from "@cookielab.io/klovi-server/services/stats-service";
import { getVersion, makeVersionState } from "@cookielab.io/klovi-server/services/version-service";
import type { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
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

// Version state — computed once at startup from package.json
const versionState = makeVersionState(pkg.version ?? "0.0.0", pkg.commit ?? "");

function runFs<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>): Promise<A> {
	return Effect.runPromise(
		effect.pipe(
			Effect.catchAll((e) => Effect.die(e)),
			Effect.provide(BunContext.layer),
		),
	);
}

function runRegistry<A, E>(
	effect: Effect.Effect<A, E, import("@cookielab.io/klovi-plugin-core").RegistryRequirements>,
): Promise<A> {
	return Effect.runPromise(
		effect.pipe(
			Effect.catchAll((e) => Effect.die(e)),
			Effect.provide(BunPluginLayer),
		),
	);
}

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
		const settings = await runFs(loadSettingsEffect(settingsPath));
		registry = await runRegistry(createRegistry(settings));
	}
	return registry;
}

async function refreshRegistry(): Promise<void> {
	const settings = await runFs(loadSettingsEffect(settingsPath));
	registry = await runRegistry(createRegistry(settings));
}

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
				return runFs(getUpdateSettingsEffect(settingsPath));
			},
			updateUpdateSettings: async (params) => {
				if (isLinux) {
					return { channel: "stable" as const, checkIntervalHours: 6, autoDownload: false };
				}
				const result = await runFs(updateUpdateSettingsEffect(settingsPath, params));
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
				await runFs(completeOnboardingEffect(settingsPath));
				await ensureRegistry();
				return { ok: true };
			},
			isFirstLaunch: () => runFs(isFirstLaunchEffect(settingsPath)),
			getVersion: () => getVersion(versionState),
			getStats: async () => {
				const reg = await ensureRegistry();
				return runRegistry(getStatsEffect(reg));
			},
			getProjects: async () => {
				const reg = await ensureRegistry();
				return runRegistry(getProjectsEffect(reg));
			},
			getSessions: async (params) => {
				const reg = await ensureRegistry();
				return runRegistry(getSessionsEffect(reg, params));
			},
			getSession: async (params) => {
				const reg = await ensureRegistry();
				return runRegistry(getSessionEffect(reg, params));
			},
			getSubAgent: async (params) => {
				const reg = await ensureRegistry();
				return runRegistry(getSubAgentEffect(reg, params));
			},
			searchSessions: async () => {
				const reg = await ensureRegistry();
				return runRegistry(searchSessionsEffect(reg));
			},
			getPluginSettings: () => runFs(getPluginSettingsEffect(settingsPath)),
			updatePluginSetting: async (params) => {
				const result = await runFs(updatePluginSettingEffect(settingsPath, params));
				await refreshRegistry();
				return result;
			},
			getGeneralSettings: () => runFs(getGeneralSettingsEffect(settingsPath)),
			updateGeneralSettings: (params) => runFs(updateGeneralSettingsEffect(settingsPath, params)),
			resetSettings: async () => {
				const result = await runFs(resetSettingsEffect(settingsPath));
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
