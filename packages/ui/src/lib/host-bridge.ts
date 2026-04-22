import type { DesktopHostRequestMap, DesktopMenuAction, DesktopRequestArgs } from "../shared/desktop-contract.ts";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import type { DashboardStats } from "../shared/types.ts";

type KloviHostCapabilities = {
	desktop: boolean;
	browseDirectory: boolean;
	updater: boolean;
	menuActions: boolean;
};

type KloviHostConnectionState = "connecting" | "connected" | "disconnected";

type DesktopHostRequestFns = {
	[K in keyof DesktopHostRequestMap]: (
		...args: DesktopRequestArgs<DesktopHostRequestMap[K]>
	) => Promise<DesktopHostRequestMap[K]["response"]>;
};

type KloviHostBridge = DesktopHostRequestFns & {
	getCapabilities: () => KloviHostCapabilities;
	getConnectionState: () => KloviHostConnectionState;
	onMenuAction: (callback: (action: DesktopMenuAction) => void) => () => void;
	onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
	onManualUpdateResult: (callback: (result: UpdateStatus) => void) => () => void;
	onStatsUpdated: (callback: (stats: DashboardStats) => void) => () => void;
	onConnectionState: (callback: (state: KloviHostConnectionState) => void) => () => void;
	onSystemThemeChange: (callback: (theme: "dark" | "light") => void) => () => void;
};

export type { KloviHostBridge, KloviHostCapabilities, KloviHostConnectionState };
