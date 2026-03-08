import { join } from "node:path";
import { startKloviServer } from "@cookielab.io/klovi-server/server";
import {
  getUpdateSettings,
  setVersion,
  updateUpdateSettings,
} from "@cookielab.io/klovi-server/services/app-services";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import pkg from "../../package.json" with { type: "json" };
import type { KloviRPC } from "../shared/rpc-types.ts";
import { UpdateManager } from "./updater.ts";

// Initialize version from package.json
setVersion(pkg.version ?? "0.0.0", pkg.commit ?? "");

let updateManager: UpdateManager | null = null;
let serverUrl = "";

function getSettingsPath(): string {
  try {
    return join(Utils.paths.userData, "settings.json");
  } catch {
    const home = Bun.env["HOME"] ?? "";
    if (process.platform === "darwin") {
      return join(
        home,
        "Library",
        "Application Support",
        "io.cookielab.klovi",
        "stable",
        "settings.json",
      );
    }
    const configHome = Bun.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
    return join(configHome, "klovi", "settings.json");
  }
}

function getUpdateManager(): UpdateManager {
  if (!updateManager) {
    updateManager = new UpdateManager({
      currentVersion: pkg.version ?? "dev",
      platform:
        process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux",
      arch: process.arch === "arm64" ? "arm64" : "x64",
      settingsPath: getSettingsPath(),
      appDataDir: Utils.paths.userData,
    });
  }
  return updateManager;
}

// Start embedded server
const server = await startKloviServer({
  host: "127.0.0.1",
  port: 0,
  mode: "embedded",
});
serverUrl = server.url;

// Start update checking
const mgr = getUpdateManager();
mgr.setStatusCallback((status) => {
  win.webview.rpc?.send.updateStatus(status);
});
await mgr.cleanup();
await mgr.startSchedule();

// Desktop RPC: only native host bridge methods
const rpc = BrowserView.defineRPC<KloviRPC>({
  handlers: {
    requests: {
      getServerUrl: () => ({ url: serverUrl }),
      browseDirectory: async (params) => {
        const paths = await Utils.openFileDialog({
          startingFolder: params.startingFolder ?? "~/",
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const selected = paths[0];
        return { path: selected && selected !== "" ? selected : null };
      },
      getUpdateSettings: () => getUpdateSettings(getSettingsPath()),
      updateUpdateSettings: async (params) => {
        const result = await updateUpdateSettings(getSettingsPath(), params);
        await mgr.restartSchedule();
        return result;
      },
      checkForUpdate: () => mgr.check(),
      applyUpdate: async () => {
        try {
          await mgr.apply();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Update failed" };
        }
      },
      openExternal: (params) => {
        Utils.openExternal(params.url);
        return { ok: true };
      },
    },
    messages: {},
  },
});

// Application menu
ApplicationMenu.setApplicationMenu([
  {
    label: "Klovi",
    submenu: [
      { label: "About Klovi", role: "about" },
      { type: "separator" },
      { label: "Preferences...", action: "openSettings", accelerator: "CmdOrCtrl+," },
      { label: "Check for Updates...", action: "checkForUpdates" },
      { type: "separator" },
      { label: "Quit Klovi", role: "quit", accelerator: "q" },
    ],
  },
  {
    label: "Edit",
    submenu: [{ role: "copy" }, { role: "selectAll" }],
  },
  {
    label: "View",
    submenu: [
      { label: "Toggle Theme", action: "cycleTheme", accelerator: "t" },
      { type: "separator" },
      { label: "Increase Font Size", action: "increaseFontSize", accelerator: "plus" },
      { label: "Decrease Font Size", action: "decreaseFontSize", accelerator: "minus" },
      { type: "separator" },
      { label: "Toggle Presentation", action: "togglePresentation", accelerator: "p" },
    ],
  },
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }],
  },
]);

const win = new BrowserWindow({
  title: "Klovi",
  url: "views://main/index.html",
  frame: { x: 0, y: 0, width: 1400, height: 900 },
  rpc,
});

// Forward menu actions to webview as RPC messages
Electrobun.events.on("application-menu-clicked", (e) => {
  const rpcSend = win.webview.rpc?.send;
  if (!rpcSend) return;
  switch (e.data.action) {
    case "cycleTheme":
      rpcSend.cycleTheme({});
      break;
    case "increaseFontSize":
      rpcSend.increaseFontSize({});
      break;
    case "decreaseFontSize":
      rpcSend.decreaseFontSize({});
      break;
    case "togglePresentation":
      rpcSend.togglePresentation({});
      break;
    case "openSettings":
      rpcSend.openSettings({});
      break;
    case "checkForUpdates":
      getUpdateManager()
        .check()
        .then((result) => {
          win.webview.rpc?.send.checkForUpdatesResult(result);
        })
        .catch(() => {});
      break;
  }
});

Electrobun.events.on("before-quit", () => {
  updateManager?.stopSchedule();
  server.stop();
});
