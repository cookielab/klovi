import { createElement } from "react";
import type { KloviClient } from "../../lib/client.ts";
import { KloviClientContext, KloviHostBridgeContext } from "../../lib/context.ts";
import type { KloviHostBridge, KloviHostCapabilities } from "../../lib/host-bridge.ts";

type MockClientOverrides = {
  [K in keyof KloviClient]?: KloviClient[K];
};

type MockHostBridgeOverrides = {
  [K in keyof KloviHostBridge]?: KloviHostBridge[K];
};

export interface MockRPCOverrides extends MockClientOverrides {
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
      }),
    getProjects: () => Promise.resolve({ projects: [] }),
    getSessions: () => Promise.resolve({ sessions: [] }),
    getSession: () =>
      Promise.resolve({
        session: { sessionId: "", project: "", turns: [] },
      }),
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
    checkForUpdate: () =>
      Promise.resolve({ status: "up-to-date" as const, currentVersion: "test" }),
    applyUpdate: () => Promise.resolve({ ok: true }),
    openExternal: () => Promise.resolve({ ok: true }),
    onMenuAction: () => () => {},
    onUpdateStatus: () => () => {},
    onManualUpdateResult: () => () => {},
    ...overrides,
  };
}

export function setupMockRPC(overrides: MockRPCOverrides = {}): void {
  const { hostBridge: hostBridgeOverrides, ...clientOverrides } = overrides;
  mockClient = createMockClient(clientOverrides);
  mockHostBridge = createMockHostBridge(hostBridgeOverrides);
}

export function getMockClient(): KloviClient {
  return mockClient;
}

export function getMockHostBridge(): KloviHostBridge {
  return mockHostBridge;
}

export function MockProviders({ children }: { children: React.ReactNode }) {
  return createElement(
    KloviClientContext.Provider,
    { value: mockClient },
    createElement(KloviHostBridgeContext.Provider, { value: mockHostBridge }, children),
  );
}

// Initialize defaults
setupMockRPC();
