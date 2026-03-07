import type { RPCClient } from "../rpc.ts";
import { setRPCClient } from "../rpc.ts";

type MockRPCOverrides = {
  [K in keyof RPCClient["request"]]?: RPCClient["request"][K];
};

export function setupMockRPC(overrides: MockRPCOverrides = {}): void {
  const defaultMock: RPCClient = {
    request: {
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
      browseDirectory: () => Promise.resolve({ path: null }),
      ...overrides,
    },
  };
  setRPCClient(defaultMock);
}
