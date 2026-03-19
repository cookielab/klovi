import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { PluginRow, type PluginRowProps } from "../app/components/settings/PluginRow.tsx";
import { UpdateNotification } from "../app/components/UpdateNotification.tsx";
import type { KloviClient } from "./client.ts";
import { KloviClientContext, KloviHostBridgeContext } from "./context.ts";
import type {
  KloviHostBridge,
  KloviHostCapabilities,
  KloviHostConnectionState,
} from "./host-bridge.ts";

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
    checkForUpdate: () =>
      Promise.resolve({ status: "up-to-date" as const, currentVersion: "0.0.0" }),
    applyUpdate: () => Promise.resolve({ ok: false }),
    openExternal: () => Promise.resolve({ ok: true }),
    onMenuAction: () => () => {},
    onUpdateStatus: () => () => {},
    onManualUpdateResult: () => () => {},
    onConnectionState: () => () => {},
    getSystemTheme: () => Promise.resolve({ theme: null }),
    onSystemThemeChange: () => () => {},
  };
}

function createMockClient(): KloviClient {
  return {
    acceptRisks: () => Promise.resolve({ ok: true }),
    isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
    getVersion: () => Promise.resolve({ version: "1.0.0", commit: "" }),
    getStats: () => Promise.resolve({ stats: {} as never }),
    getProjects: () => Promise.resolve({ projects: [] }),
    getSessions: () => Promise.resolve({ sessions: [] }),
    getSession: () => Promise.resolve({ session: {} as never }),
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
) {
  const client = createMockClient();
  const hostBridge = createMockHostBridge(caps);
  return render(
    createElement(
      KloviClientContext.Provider,
      { value: client },
      createElement(KloviHostBridgeContext.Provider, { value: hostBridge }, element),
    ),
  );
}

describe("UpdateNotification capability gating", () => {
  test("returns null when updater capability is false", () => {
    const { container } = renderWithProviders(
      createElement(UpdateNotification, {
        status: { status: "ready", latestVersion: "2.0.0", currentVersion: "1.0.0" },
        dismissed: false,
        onDismiss: () => {},
        manualCheckResult: null,
        onDismissManualCheck: () => {},
      }),
      { updater: false },
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders when updater capability is true and update ready", () => {
    const { container } = renderWithProviders(
      createElement(UpdateNotification, {
        status: { status: "ready", latestVersion: "2.0.0", currentVersion: "1.0.0" },
        dismissed: false,
        onDismiss: () => {},
        manualCheckResult: null,
        onDismissManualCheck: () => {},
      }),
      { updater: true },
    );
    expect(container.innerHTML).not.toBe("");
    expect(container.textContent).toContain("2.0.0");
  });
});

afterEach(cleanup);

describe("PluginRow browse button gating", () => {
  const basePlugin: PluginRowProps["plugin"] = {
    id: "test-plugin",
    displayName: "Test Plugin",
    enabled: true,
    dataDir: "/data",
    defaultDataDir: "/default",
    isCustomDir: false,
  };

  test("shows Browse button when canBrowse is true", () => {
    render(
      createElement(PluginRow, {
        plugin: basePlugin,
        onToggle: () => {},
        onBrowse: () => {},
        onPathChange: () => {},
        onReset: () => {},
        canBrowse: true,
      }),
    );
    expect(screen.getByText("Browse")).toBeTruthy();
  });

  test("hides Browse button when canBrowse is false", () => {
    render(
      createElement(PluginRow, {
        plugin: basePlugin,
        onToggle: () => {},
        onBrowse: () => {},
        onPathChange: () => {},
        onReset: () => {},
        canBrowse: false,
      }),
    );
    expect(screen.queryByText("Browse")).toBeNull();
  });

  test("shows Browse button by default (canBrowse undefined)", () => {
    render(
      createElement(PluginRow, {
        plugin: basePlugin,
        onToggle: () => {},
        onBrowse: () => {},
        onPathChange: () => {},
        onReset: () => {},
      }),
    );
    expect(screen.getByText("Browse")).toBeTruthy();
  });
});
