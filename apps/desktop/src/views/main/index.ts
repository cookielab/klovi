import type {
  KloviClient,
  KloviHostBridge,
  KloviHostCapabilities,
} from "@cookielab.io/klovi-web/bootstrap";
import { mountKloviApp } from "@cookielab.io/klovi-web/bootstrap";
import { Electroview } from "electrobun/view";
import type { KloviRPC, UpdateStatus } from "../../shared/rpc-types.ts";

// Import design system globals (tokens, reset, fonts)
import "@cookielab.io/klovi-design-system/globals";

// Import app-specific styles
import "@cookielab.io/klovi-web/app/App.css";

type MenuAction =
  | "cycleTheme"
  | "increaseFontSize"
  | "decreaseFontSize"
  | "togglePresentation"
  | "openSettings";

const menuActionListeners = new Set<(action: MenuAction) => void>();
const updateStatusListeners = new Set<(status: UpdateStatus) => void>();
const manualUpdateListeners = new Set<(result: UpdateStatus) => void>();

const rpc = Electroview.defineRPC<KloviRPC>({
  maxRequestTime: 30_000,
  handlers: {
    requests: {},
    messages: {
      cycleTheme: () => {
        for (const cb of menuActionListeners) cb("cycleTheme");
      },
      increaseFontSize: () => {
        for (const cb of menuActionListeners) cb("increaseFontSize");
      },
      decreaseFontSize: () => {
        for (const cb of menuActionListeners) cb("decreaseFontSize");
      },
      togglePresentation: () => {
        for (const cb of menuActionListeners) cb("togglePresentation");
      },
      openSettings: () => {
        for (const cb of menuActionListeners) cb("openSettings");
      },
      updateStatus: (data) => {
        for (const cb of updateStatusListeners) cb(data);
      },
      checkForUpdatesResult: (data) => {
        for (const cb of manualUpdateListeners) cb(data);
      },
    },
  },
});

// Electroview constructor initializes WebSocket transport and wires up the RPC
new Electroview({ rpc });

// Adapt Electrobun RPC to KloviClient
const desktopClient: KloviClient = {
  acceptRisks: () => rpc.request.acceptRisks({} as Record<string, never>),
  isFirstLaunch: () => rpc.request.isFirstLaunch({} as Record<string, never>),
  getVersion: () => rpc.request.getVersion({} as Record<string, never>),
  getStats: () => rpc.request.getStats({} as Record<string, never>),
  getProjects: () => rpc.request.getProjects({} as Record<string, never>),
  getSessions: (params) => rpc.request.getSessions(params),
  getSession: (params) => rpc.request.getSession(params),
  getSubAgent: (params) => rpc.request.getSubAgent(params),
  searchSessions: () => rpc.request.searchSessions({} as Record<string, never>),
  getPluginSettings: () => rpc.request.getPluginSettings({} as Record<string, never>),
  updatePluginSetting: (params) => rpc.request.updatePluginSetting(params),
  getGeneralSettings: () => rpc.request.getGeneralSettings({} as Record<string, never>),
  updateGeneralSettings: (params) => rpc.request.updateGeneralSettings(params),
  resetSettings: () => rpc.request.resetSettings({} as Record<string, never>),
};

const desktopCapabilities: KloviHostCapabilities = {
  desktop: true,
  browseDirectory: true,
  updater: true,
  menuActions: true,
};

// Adapt Electrobun RPC to KloviHostBridge
const desktopHostBridge: KloviHostBridge = {
  getCapabilities: () => desktopCapabilities,
  browseDirectory: (params) => rpc.request.browseDirectory(params),
  getUpdateSettings: () => rpc.request.getUpdateSettings({} as Record<string, never>),
  updateUpdateSettings: (params) => rpc.request.updateUpdateSettings(params),
  checkForUpdate: () => rpc.request.checkForUpdate({} as Record<string, never>),
  applyUpdate: () => rpc.request.applyUpdate({} as Record<string, never>),
  openExternal: (params) => rpc.request.openExternal(params),
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
};

// Mount shared app
// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.getElementById("root")!;
mountKloviApp({
  container,
  client: desktopClient,
  hostBridge: desktopHostBridge,
});
