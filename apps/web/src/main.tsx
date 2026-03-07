import { mountKloviApp } from "./bootstrap.tsx";
import { browserHostBridge } from "./lib/browser-host-bridge.ts";
import type { KloviClient } from "./lib/client.ts";

const stubClient: KloviClient = {
  acceptRisks: () => Promise.resolve({ ok: true }),
  isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
  getVersion: () => Promise.resolve({ version: "0.0.0", commit: "" }),
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
    Promise.resolve({ session: { sessionId: "", turns: [], pluginId: "" } as never }),
  getSubAgent: () =>
    Promise.resolve({ session: { sessionId: "", turns: [], pluginId: "" } as never }),
  searchSessions: () => Promise.resolve({ sessions: [] }),
  getPluginSettings: () => Promise.resolve({ plugins: [] }),
  updatePluginSetting: () => Promise.resolve({ plugins: [] }),
  getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
  updateGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
  resetSettings: () => Promise.resolve({ ok: true }),
};

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.getElementById("root")!;

mountKloviApp({
  container,
  client: stubClient,
  hostBridge: browserHostBridge,
});
