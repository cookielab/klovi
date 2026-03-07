import type { KloviClient, KloviHostBridge, KloviHostCapabilities } from "./bootstrap.tsx";
import { mountKloviApp } from "./bootstrap.tsx";

const noopCapabilities: KloviHostCapabilities = {
  desktop: false,
  browseDirectory: false,
  updater: false,
  menuActions: false,
};

const stubClient: KloviClient = {
  acceptRisks: () => Promise.resolve(),
  isFirstLaunch: () => Promise.resolve(false),
  getVersion: () => Promise.resolve({ version: "0.0.0", commit: "" }),
  getStats: () => Promise.resolve(null),
  getProjects: () => Promise.resolve([]),
  getSessions: () => Promise.resolve([]),
  getSession: () => Promise.resolve(null),
  getSubAgent: () => Promise.resolve(null),
  searchSessions: () => Promise.resolve([]),
  getPluginSettings: () => Promise.resolve([]),
  updatePluginSetting: () => Promise.resolve(null),
  getGeneralSettings: () => Promise.resolve(null),
  updateGeneralSettings: () => Promise.resolve(null),
  resetSettings: () => Promise.resolve(),
};

const stubHostBridge: KloviHostBridge = {
  getCapabilities: () => noopCapabilities,
  browseDirectory: () => Promise.resolve(null),
  getUpdateSettings: () => Promise.resolve(null),
  updateUpdateSettings: () => Promise.resolve(null),
  checkForUpdate: () => Promise.resolve(),
  applyUpdate: () => Promise.resolve(),
  openExternal: () => Promise.resolve(),
  onMenuAction: () => () => {},
  onUpdateStatus: () => () => {},
  onManualUpdateResult: () => () => {},
};

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.getElementById("root")!;

mountKloviApp({
  container,
  client: stubClient,
  hostBridge: stubHostBridge,
});
