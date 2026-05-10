import { createElement } from "react";
import type { KloviClient } from "../../lib/client";
import { KloviRuntimeProvider } from "../../lib/context";
import type { KloviHostBridge, KloviHostCapabilities, KloviHostConnectionState } from "../../lib/host-bridge";

type MockClientOverrides = {
	[K in keyof KloviClient]?: KloviClient[K];
};

type MockHostBridgeOverrides = {
	[K in keyof KloviHostBridge]?: KloviHostBridge[K];
};

interface MockRPCOverrides extends MockClientOverrides {
	hostBridge?: MockHostBridgeOverrides;
}

const defaultCapabilities: KloviHostCapabilities = {
	desktop: true,
	browseDirectory: true,
	updater: true,
	menuActions: true,
};

let mockClient: KloviClient;
let mockHostBridge: KloviHostBridge;
let mockConnectionState: KloviHostConnectionState = "connected";
const connectionStateListeners = new Set<(state: KloviHostConnectionState) => void>();

function createMockClient(overrides: MockClientOverrides = {}): KloviClient {
	return {
		acceptRisks: () => Promise.resolve({ ok: true }),
		isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
		getVersion: () => Promise.resolve({ version: "test", commit: "abc123" }),
		getStats: () =>
			Promise.resolve({
				stats: {
					projects: 0,
					sessions: 0,
					messages: 0,
					todaySessions: 0,
					thisWeekSessions: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
					cacheCreationTokens: 0,
					toolCalls: 0,
					models: {},
				},
				refreshing: false,
			}),
		getProjects: () => Promise.resolve({ projects: [] }),
		getSessions: () => Promise.resolve({ sessions: [] }),
		getSession: () =>
			Promise.resolve({
				session: { sessionId: "", project: "", turns: [] },
			}),
		getSessionHead: () =>
			Promise.resolve({
				session: { sessionId: "", project: "", turns: [] },
				totalTurns: 0,
			}),
		getSessionTail: () => Promise.resolve({ turns: [] }),
		getSubAgent: () =>
			Promise.resolve({
				session: { sessionId: "", project: "", turns: [] },
			}),
		searchSessions: () => Promise.resolve({ sessions: [] }),
		getPluginSettings: () => Promise.resolve({ plugins: [] }),
		updatePluginSetting: () => Promise.resolve({ plugins: [] }),
		getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		updateGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		resetSettings: () => Promise.resolve({ ok: true }),
		...overrides,
	} as KloviClient;
}

function createMockHostBridge(overrides: MockHostBridgeOverrides = {}): KloviHostBridge {
	return {
		getCapabilities: () => defaultCapabilities,
		getConnectionState: () => mockConnectionState,
		browseDirectory: () => Promise.resolve({ path: null }),
		getUpdateSettings: () =>
			Promise.resolve({
				channel: "stable" as const,
				checkIntervalHours: 6,
				autoDownload: true,
			}),
		updateUpdateSettings: () =>
			Promise.resolve({
				channel: "stable" as const,
				checkIntervalHours: 6,
				autoDownload: true,
			}),
		checkForUpdate: () => Promise.resolve({ status: "up-to-date" as const, currentVersion: "test" }),
		applyUpdate: () => Promise.resolve({ ok: true }),
		openExternal: () => Promise.resolve({ ok: true }),
		onMenuAction: () => () => undefined,
		onUpdateStatus: () => () => undefined,
		onManualUpdateResult: () => () => undefined,
		onStatsUpdated: () => () => undefined,
		onConnectionState: (callback) => {
			connectionStateListeners.add(callback);
			return () => {
				connectionStateListeners.delete(callback);
			};
		},
		getSystemTheme: () => Promise.resolve({ theme: null }),
		onSystemThemeChange: () => () => undefined,
		...overrides,
	};
}

function setupMockRPC(overrides: MockRPCOverrides = {}): void {
	const { hostBridge: hostBridgeOverrides, ...clientOverrides } = overrides;
	mockConnectionState = "connected";
	connectionStateListeners.clear();
	mockClient = createMockClient(clientOverrides);
	mockHostBridge = createMockHostBridge(hostBridgeOverrides);
}

function getMockClient(): KloviClient {
	return mockClient;
}

function getMockHostBridge(): KloviHostBridge {
	return mockHostBridge;
}

function setMockHostConnectionState(state: KloviHostConnectionState): void {
	mockConnectionState = state;
	for (const listener of connectionStateListeners) {
		listener(state);
	}
}

function MockProviders({ children }: { children: React.ReactNode }) {
	return createElement(KloviRuntimeProvider, { client: mockClient, hostBridge: mockHostBridge }, children);
}

// Initialize defaults
setupMockRPC();

export type { MockRPCOverrides };
export { getMockClient, getMockHostBridge, MockProviders, setMockHostConnectionState, setupMockRPC };
