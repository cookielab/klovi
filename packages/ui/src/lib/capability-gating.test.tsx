import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { PluginRow, type PluginRowProps } from "../app/components/settings/PluginRow";
import { UpdateNotification } from "../app/components/UpdateNotification";
import type { KloviClient } from "./client";
import { KloviRuntimeProvider } from "./context";
import type { KloviHostBridge, KloviHostCapabilities, KloviHostConnectionState } from "./host-bridge";

const noop = (): undefined => undefined;
function createMockHostBridge(caps: Partial<KloviHostCapabilities> = {}): KloviHostBridge {
	const capabilities: KloviHostCapabilities = {
		desktop: false,
		browseDirectory: false,
		updater: false,
		menuActions: false,
		...caps,
	};
	const connectionState: KloviHostConnectionState = "connected";
	return {
		getCapabilities: () => capabilities,
		getConnectionState: () => connectionState,
		browseDirectory: () => Promise.resolve({ path: null }),
		getUpdateSettings: () =>
			Promise.resolve({ channel: "stable" as const, checkIntervalHours: 0, autoDownload: false }),
		updateUpdateSettings: () =>
			Promise.resolve({ channel: "stable" as const, checkIntervalHours: 0, autoDownload: false }),
		checkForUpdate: () => Promise.resolve({ status: "up-to-date" as const, currentVersion: "0.0.0" }),
		applyUpdate: () => Promise.resolve({ ok: false }),
		openExternal: () => Promise.resolve({ ok: true }),
		onMenuAction: () => noop,
		onUpdateStatus: () => noop,
		onManualUpdateResult: () => noop,
		onStatsUpdated: () => noop,
		onConnectionState: () => noop,
		getSystemTheme: () => Promise.resolve({ theme: null }),
		onSystemThemeChange: () => noop,
	};
}

function createMockClient(): KloviClient {
	return {
		acceptRisks: () => Promise.resolve({ ok: true }),
		isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
		getVersion: () => Promise.resolve({ version: "1.0.0", commit: "" }),
		getStats: () => Promise.resolve({ stats: {} as never, refreshing: false }),
		getProjects: () => Promise.resolve({ projects: [] }),
		getSessions: () => Promise.resolve({ sessions: [] }),
		getSession: () => Promise.resolve({ session: {} as never }),
		getSessionHead: () => Promise.resolve({ session: {} as never, totalTurns: 0 }),
		getSessionTail: () => Promise.resolve({ turns: [] }),
		getSubAgent: () => Promise.resolve({ session: {} as never }),
		searchSessions: () => Promise.resolve({ sessions: [] }),
		getPluginSettings: () => Promise.resolve({ plugins: [] }),
		updatePluginSetting: () => Promise.resolve({ plugins: [] }),
		getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
		updateGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
		resetSettings: () => Promise.resolve({ ok: true }),
	};
}

function renderWithProviders(
	element: React.ReactElement,
	caps: Partial<KloviHostCapabilities> = {},
): ReturnType<typeof render> {
	const client = createMockClient();
	const hostBridge = createMockHostBridge(caps);
	return render(createElement(KloviRuntimeProvider, { client: client, hostBridge: hostBridge }, element));
}

describe("UpdateNotification capability gating", () => {
	it("returns null when updater capability is false", () => {
		const { container } = renderWithProviders(
			createElement(UpdateNotification, {
				status: { status: "ready", latestVersion: "2.0.0", currentVersion: "1.0.0" },
				dismissed: false,
				onDismiss: noop,
				manualCheckResult: null,
				onDismissManualCheck: noop,
			}),
			{ updater: false },
		);
		expect(container.innerHTML).toBe("");
	});

	it("renders when updater capability is true and update ready", () => {
		const { container } = renderWithProviders(
			createElement(UpdateNotification, {
				status: { status: "ready", latestVersion: "2.0.0", currentVersion: "1.0.0" },
				dismissed: false,
				onDismiss: noop,
				manualCheckResult: null,
				onDismissManualCheck: noop,
			}),
			{ updater: true },
		);
		expect(container.innerHTML).not.toBe("");
		expect(container.textContent).toContain("2.0.0");
	});
});

afterEach(cleanup);

describe("PluginRow status badge", () => {
	it("renders '(beta)' suffix when plugin.status is 'beta'", () => {
		const betaPlugin: PluginRowProps["plugin"] = {
			id: "any-plugin",
			displayName: "Any Plugin",
			status: "beta",
			enabled: true,
			dataDir: "/data",
			defaultDataDir: "/default",
			isCustomDir: false,
		};
		render(
			createElement(PluginRow, {
				plugin: betaPlugin,
				onToggle: noop,
				onBrowse: noop,
				onPathChange: noop,
				onReset: noop,
			}),
		);
		expect(screen.getByText("Any Plugin (beta)")).toBeTruthy();
	});

	it("does not render '(beta)' suffix when plugin.status is undefined", () => {
		const stablePlugin: PluginRowProps["plugin"] = {
			id: "any-plugin",
			displayName: "Any Plugin",
			enabled: true,
			dataDir: "/data",
			defaultDataDir: "/default",
			isCustomDir: false,
		};
		render(
			createElement(PluginRow, {
				plugin: stablePlugin,
				onToggle: noop,
				onBrowse: noop,
				onPathChange: noop,
				onReset: noop,
			}),
		);
		expect(screen.getByText("Any Plugin")).toBeTruthy();
		expect(screen.queryByText("Any Plugin (beta)")).toBeNull();
	});
});

describe("PluginRow browse button gating", () => {
	const basePlugin: PluginRowProps["plugin"] = {
		id: "test-plugin",
		displayName: "Test Plugin",
		enabled: true,
		dataDir: "/data",
		defaultDataDir: "/default",
		isCustomDir: false,
	};

	it("shows Browse button when canBrowse is true", () => {
		render(
			createElement(PluginRow, {
				plugin: basePlugin,
				onToggle: noop,
				onBrowse: noop,
				onPathChange: noop,
				onReset: noop,
				canBrowse: true,
			}),
		);
		expect(screen.getByText("Browse")).toBeTruthy();
	});

	it("hides Browse button when canBrowse is false", () => {
		render(
			createElement(PluginRow, {
				plugin: basePlugin,
				onToggle: noop,
				onBrowse: noop,
				onPathChange: noop,
				onReset: noop,
				canBrowse: false,
			}),
		);
		expect(screen.queryByText("Browse")).toBeNull();
	});

	it("shows Browse button by default (canBrowse undefined)", () => {
		render(
			createElement(PluginRow, {
				plugin: basePlugin,
				onToggle: noop,
				onBrowse: noop,
				onPathChange: noop,
				onReset: noop,
			}),
		);
		expect(screen.getByText("Browse")).toBeTruthy();
	});
});
