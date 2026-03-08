import type { KloviHostBridge, KloviHostCapabilities } from "@cookielab.io/klovi-ui/bootstrap";
import { createHttpClient, mountKloviApp } from "@cookielab.io/klovi-ui/bootstrap";
import { Electroview } from "electrobun/view";
import type { KloviRPC, UpdateStatus } from "../../shared/rpc-types.ts";

// Import design system globals (tokens, reset, fonts) via apps/web
import "@cookielab.io/klovi-ui/styles";

// Import app-specific styles
import "@cookielab.io/klovi-ui/app/App.css";

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

// Get the embedded server URL and create an HTTP-backed client
const { url: serverUrl } = await rpc.request.getServerUrl({} as Record<string, never>);
const desktopClient = createHttpClient(serverUrl);

const desktopCapabilities: KloviHostCapabilities = {
  desktop: true,
  browseDirectory: true,
  updater: true,
  menuActions: true,
};

// Desktop host bridge: native methods via Electrobun RPC
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
