import type {
	DashboardStats,
	KloviClient,
	KloviHostBridge,
	KloviHostCapabilities,
	KloviHostConnectionState,
} from "@cookielab.io/klovi-ui/bootstrap";
import {
	createRpcDisconnectedError,
	createRpcTimeoutError,
	isRpcTransportError,
	mountKloviApp,
} from "@cookielab.io/klovi-ui/bootstrap";
import type { DesktopMenuAction, DesktopRequestMethod } from "@cookielab.io/klovi-ui/shared/desktop-contract";
import { Electroview } from "electrobun/view";
import type { KloviRPC, UpdateStatus } from "../../shared/rpc-types.ts";

// Import design system globals (tokens, reset, fonts) via klovi-ui
import "@cookielab.io/klovi-ui/styles";

const menuActionListeners = new Set<(action: DesktopMenuAction) => void>();
const updateStatusListeners = new Set<(status: UpdateStatus) => void>();
const manualUpdateListeners = new Set<(result: UpdateStatus) => void>();
const statsUpdatedListeners = new Set<(stats: DashboardStats) => void>();
const connectionStateListeners = new Set<(state: KloviHostConnectionState) => void>();
const systemThemeListeners = new Set<(theme: "dark" | "light") => void>();

type DesktopRpcMethod = DesktopRequestMethod;

const DEFAULT_RPC_TIMEOUT = 30_000;
const RPC_TIMEOUTS: Partial<Record<DesktopRpcMethod, number>> = {
	getProjects: 120_000,
	getSessions: 120_000,
	searchSessions: 120_000,
	getStats: 120_000,
	getSession: 60_000,
	getSubAgent: 60_000,
};

let hostConnectionState: KloviHostConnectionState = "connecting";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const INITIAL_RECONNECT_DELAY = 1000;
let reconnectDelay = INITIAL_RECONNECT_DELAY;
const MAX_RECONNECT_DELAY = 30_000;
const observedSockets = new WeakSet<WebSocket>();

const rpc = Electroview.defineRPC<KloviRPC>({
	maxRequestTime: Number.POSITIVE_INFINITY,
	handlers: {
		requests: {},
		messages: {
			cycleTheme: () => {
				for (const cb of menuActionListeners) {
					cb("cycleTheme");
				}
			},
			increaseFontSize: () => {
				for (const cb of menuActionListeners) {
					cb("increaseFontSize");
				}
			},
			decreaseFontSize: () => {
				for (const cb of menuActionListeners) {
					cb("decreaseFontSize");
				}
			},
			togglePresentation: () => {
				for (const cb of menuActionListeners) {
					cb("togglePresentation");
				}
			},
			openSettings: () => {
				for (const cb of menuActionListeners) {
					cb("openSettings");
				}
			},
			updateStatus: (data) => {
				for (const cb of updateStatusListeners) {
					cb(data);
				}
			},
			checkForUpdatesResult: (data) => {
				for (const cb of manualUpdateListeners) {
					cb(data);
				}
			},
			statsUpdated: (data) => {
				for (const cb of statsUpdatedListeners) {
					cb(data.stats);
				}
			},
			systemThemeChanged: (data) => {
				for (const cb of systemThemeListeners) {
					cb(data.theme);
				}
			},
		},
	},
});

// Electroview constructor initializes WebSocket transport and wires up the RPC
const electroview = new Electroview({ rpc: rpc });

function setHostConnectionState(nextState: KloviHostConnectionState): void {
	if (hostConnectionState === nextState) {
		return;
	}

	hostConnectionState = nextState;
	for (const listener of connectionStateListeners) {
		listener(nextState);
	}
}

function clearReconnectTimer(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}

function attachSocketStateListeners(socket: WebSocket | undefined): void {
	if (!socket || observedSockets.has(socket)) {
		return;
	}

	observedSockets.add(socket);

	socket.addEventListener("open", () => {
		clearReconnectTimer();
		reconnectDelay = INITIAL_RECONNECT_DELAY;
		setHostConnectionState("connected");
	});

	socket.addEventListener("error", () => {
		if (socket.readyState !== WebSocket.OPEN) {
			setHostConnectionState("disconnected");
			scheduleReconnect();
		}
	});

	socket.addEventListener("close", () => {
		if (electroview.bunSocket === socket || hostConnectionState === "connected") {
			setHostConnectionState("disconnected");
		}
		scheduleReconnect();
	});
}

function reconnectSocket(): void {
	if (
		electroview.bunSocket?.readyState === WebSocket.OPEN ||
		electroview.bunSocket?.readyState === WebSocket.CONNECTING
	) {
		return;
	}

	setHostConnectionState("connecting");
	electroview.initSocketToBun();
	attachSocketStateListeners(electroview.bunSocket);
}

function scheduleReconnect(): void {
	if (reconnectTimer) {
		return;
	}

	const delay = reconnectDelay;
	reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		reconnectSocket();
	}, delay);
}

function waitForHostConnection(timeoutMs: number): Promise<boolean> {
	if (hostConnectionState === "connected") {
		return Promise.resolve(true);
	}

	if (hostConnectionState === "disconnected") {
		scheduleReconnect();
	}

	return new Promise((resolve) => {
		const timeoutId = setTimeout(() => {
			unsubscribe();
			resolve(false);
		}, timeoutMs);

		const unsubscribe = desktopHostBridge.onConnectionState((state) => {
			if (state !== "connected") {
				return;
			}

			clearTimeout(timeoutId);
			unsubscribe();
			resolve(true);
		});
	});
}

const MAX_CONNECTION_WAIT = 5000;

async function callDesktopRpc<T>(method: DesktopRpcMethod, fn: () => Promise<T>, timeoutMs: number): Promise<T> {
	const connected = await waitForHostConnection(Math.min(timeoutMs, MAX_CONNECTION_WAIT));
	if (!connected) {
		throw createRpcDisconnectedError(String(method));
	}

	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			Promise.resolve().then(fn),
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(createRpcTimeoutError(String(method), timeoutMs));
				}, timeoutMs);
			}),
		]);
	} catch (error) {
		if (isRpcTransportError(error)) {
			setHostConnectionState("disconnected");
			scheduleReconnect();
		}
		throw error;
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

function getRpcTimeout(method: DesktopRpcMethod): number {
	return RPC_TIMEOUTS[method] ?? DEFAULT_RPC_TIMEOUT;
}

attachSocketStateListeners(electroview.bunSocket);

// RPC-backed KloviClient: each method delegates to the main process via Electrobun RPC
const empty = {} as Record<string, never>;
const desktopClient: KloviClient = {
	acceptRisks: () => callDesktopRpc("acceptRisks", () => rpc.request.acceptRisks(empty), getRpcTimeout("acceptRisks")),
	isFirstLaunch: () =>
		callDesktopRpc("isFirstLaunch", () => rpc.request.isFirstLaunch(empty), getRpcTimeout("isFirstLaunch")),
	getVersion: () => callDesktopRpc("getVersion", () => rpc.request.getVersion(empty), getRpcTimeout("getVersion")),
	getStats: () => callDesktopRpc("getStats", () => rpc.request.getStats(empty), getRpcTimeout("getStats")),
	getProjects: () => callDesktopRpc("getProjects", () => rpc.request.getProjects(empty), getRpcTimeout("getProjects")),
	getSessions: (params) =>
		callDesktopRpc("getSessions", () => rpc.request.getSessions(params), getRpcTimeout("getSessions")),
	getSession: (params) =>
		callDesktopRpc("getSession", () => rpc.request.getSession(params), getRpcTimeout("getSession")),
	getSessionHead: (params) =>
		callDesktopRpc("getSessionHead", () => rpc.request.getSessionHead(params), getRpcTimeout("getSessionHead")),
	getSessionTail: (params) =>
		callDesktopRpc("getSessionTail", () => rpc.request.getSessionTail(params), getRpcTimeout("getSessionTail")),
	getSubAgent: (params) =>
		callDesktopRpc("getSubAgent", () => rpc.request.getSubAgent(params), getRpcTimeout("getSubAgent")),
	searchSessions: () =>
		callDesktopRpc("searchSessions", () => rpc.request.searchSessions(empty), getRpcTimeout("searchSessions")),
	getPluginSettings: () =>
		callDesktopRpc("getPluginSettings", () => rpc.request.getPluginSettings(empty), getRpcTimeout("getPluginSettings")),
	updatePluginSetting: (params) =>
		callDesktopRpc(
			"updatePluginSetting",
			() => rpc.request.updatePluginSetting(params),
			getRpcTimeout("updatePluginSetting"),
		),
	getGeneralSettings: () =>
		callDesktopRpc(
			"getGeneralSettings",
			() => rpc.request.getGeneralSettings(empty),
			getRpcTimeout("getGeneralSettings"),
		),
	updateGeneralSettings: (params) =>
		callDesktopRpc(
			"updateGeneralSettings",
			() => rpc.request.updateGeneralSettings(params),
			getRpcTimeout("updateGeneralSettings"),
		),
	resetSettings: () =>
		callDesktopRpc("resetSettings", () => rpc.request.resetSettings(empty), getRpcTimeout("resetSettings")),
};

const isLinux = navigator.platform.startsWith("Linux");

const desktopCapabilities: KloviHostCapabilities = {
	desktop: true,
	browseDirectory: true,
	updater: !isLinux,
	menuActions: true,
};

// Desktop host bridge: native methods via Electrobun RPC
const desktopHostBridge: KloviHostBridge = {
	getCapabilities: () => desktopCapabilities,
	getConnectionState: () => hostConnectionState,
	browseDirectory: (params) =>
		callDesktopRpc("browseDirectory", () => rpc.request.browseDirectory(params), getRpcTimeout("browseDirectory")),
	getUpdateSettings: () =>
		callDesktopRpc("getUpdateSettings", () => rpc.request.getUpdateSettings(empty), getRpcTimeout("getUpdateSettings")),
	updateUpdateSettings: (params) =>
		callDesktopRpc(
			"updateUpdateSettings",
			() => rpc.request.updateUpdateSettings(params),
			getRpcTimeout("updateUpdateSettings"),
		),
	checkForUpdate: () =>
		callDesktopRpc("checkForUpdate", () => rpc.request.checkForUpdate(empty), getRpcTimeout("checkForUpdate")),
	applyUpdate: () => callDesktopRpc("applyUpdate", () => rpc.request.applyUpdate(empty), getRpcTimeout("applyUpdate")),
	openExternal: (params) =>
		callDesktopRpc("openExternal", () => rpc.request.openExternal(params), getRpcTimeout("openExternal")),
	onMenuAction: (callback) => {
		menuActionListeners.add(callback);
		return () => {
			menuActionListeners.delete(callback);
		};
	},
	onUpdateStatus: (callback) => {
		updateStatusListeners.add(callback);
		return () => {
			updateStatusListeners.delete(callback);
		};
	},
	onManualUpdateResult: (callback) => {
		manualUpdateListeners.add(callback);
		return () => {
			manualUpdateListeners.delete(callback);
		};
	},
	onStatsUpdated: (callback) => {
		statsUpdatedListeners.add(callback);
		return () => {
			statsUpdatedListeners.delete(callback);
		};
	},
	onConnectionState: (callback) => {
		connectionStateListeners.add(callback);
		return () => {
			connectionStateListeners.delete(callback);
		};
	},
	getSystemTheme: () =>
		callDesktopRpc("getSystemTheme", () => rpc.request.getSystemTheme(empty), getRpcTimeout("getSystemTheme")),
	onSystemThemeChange: (callback) => {
		systemThemeListeners.add(callback);
		return () => {
			systemThemeListeners.delete(callback);
		};
	},
};

// Mount shared app
// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.querySelector<HTMLElement>("#root")!;
mountKloviApp({
	container: container,
	client: desktopClient,
	hostBridge: desktopHostBridge,
});
