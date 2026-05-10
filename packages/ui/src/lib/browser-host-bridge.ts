import type { UpdateSettingsInfo, UpdateStatus } from "../shared/rpc-types";
import type { KloviHostBridge, KloviHostCapabilities } from "./host-bridge";

const browserCapabilities: KloviHostCapabilities = {
	desktop: false,
	browseDirectory: false,
	updater: false,
	menuActions: false,
};

export const browserHostBridge: KloviHostBridge = {
	getCapabilities: () => browserCapabilities,
	getConnectionState: () => "connected",
	browseDirectory: () => Promise.resolve({ path: null }),
	getUpdateSettings: () =>
		Promise.resolve({
			channel: "stable",
			checkIntervalHours: 0,
			autoDownload: false,
		} satisfies UpdateSettingsInfo),
	updateUpdateSettings: () =>
		Promise.resolve({
			channel: "stable",
			checkIntervalHours: 0,
			autoDownload: false,
		} satisfies UpdateSettingsInfo),
	checkForUpdate: () => Promise.resolve({ status: "up-to-date", currentVersion: "0.0.0" } satisfies UpdateStatus),
	applyUpdate: () => Promise.resolve({ ok: false, error: "Not supported in browser mode" }),
	openExternal: (params) => {
		window.open(params.url, "_blank", "noopener,noreferrer");
		return Promise.resolve({ ok: true });
	},
	onMenuAction: () => () => undefined,
	onUpdateStatus: () => () => undefined,
	onManualUpdateResult: () => () => undefined,
	onStatsUpdated: () => () => undefined,
	onConnectionState: () => () => undefined,
	getSystemTheme: () => Promise.resolve({ theme: null }),
	onSystemThemeChange: () => () => undefined,
};
