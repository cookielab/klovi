import { join } from "node:path";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import { createRegistry } from "../plugins/auto-discover.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import type { KloviRPC } from "../shared/rpc-types.ts";
import {
  getGeneralSettings,
  getPluginSettings,
  getProjects,
  getSession,
  getSessions,
  getStats,
  getSubAgent,
  getUpdateSettings,
  getVersion,
  isFirstLaunch,
  resetSettings,
  searchSessions,
  updateGeneralSettings,
  updatePluginSetting,
  updateUpdateSettings,
} from "./rpc-handlers.ts";
import { loadSettings } from "./settings.ts";
import { UpdateManager } from "./updater.ts";

let registry: PluginRegistry | null = null;
let updateManager: UpdateManager | null = null;

function getUpdateManager(): UpdateManager {
  if (!updateManager) {
    updateManager = new UpdateManager({
      currentVersion: getVersion().version,
      platform:
        process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux",
      arch: process.arch === "arm64" ? "arm64" : "x64",
      settingsPath: getSettingsPath(),
      appDataDir: Utils.paths.userData,
    });
  }
  return updateManager;
}

function getRegistry(): PluginRegistry {
  if (!registry) throw new Error("Risk not accepted yet");
  return registry;
}

function getSettingsPath(): string {
  try {
    return join(Utils.paths.userData, "settings.json");
  } catch {
    // Fallback if version.json not readable (e.g. dev mode outside app bundle)
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
    // Linux: use XDG_CONFIG_HOME or ~/.config
    const configHome = Bun.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
    return join(configHome, "klovi", "settings.json");
  }
}

const rpc = BrowserView.defineRPC<KloviRPC>({
  handlers: {
    requests: {
      acceptRisks: async () => {
        if (!registry) {
          const settings = await loadSettings(getSettingsPath());
          registry = await createRegistry(settings);
        }

        // Start update checking
        const mgr = getUpdateManager();
        mgr.setStatusCallback((status) => {
          win.webview.rpc?.send.updateStatus(status);
        });
        await mgr.cleanup();
        await mgr.startSchedule();

        return { ok: true };
      },
      // getVersion, isFirstLaunch, and getGeneralSettings read settings only — intentionally ungated
      getVersion: () => getVersion(),
      isFirstLaunch: () => isFirstLaunch(getSettingsPath()),
      resetSettings: async () => {
        const result = await resetSettings(getSettingsPath());
        registry = null;
        return result;
      },
      getGeneralSettings: () => getGeneralSettings(getSettingsPath()),
      updateGeneralSettings: (params) => updateGeneralSettings(getSettingsPath(), params),
      getStats: () => getStats(getRegistry()),
      getProjects: () => getProjects(getRegistry()),
      getSessions: (params) => getSessions(getRegistry(), params),
      getSession: (params) => getSession(getRegistry(), params),
      getSubAgent: (params) => getSubAgent(getRegistry(), params),
      searchSessions: () => searchSessions(getRegistry()),
      getPluginSettings: () => getPluginSettings(getSettingsPath()),
      updatePluginSetting: async (params) => {
        const result = await updatePluginSetting(getSettingsPath(), params);
        registry = await createRegistry(await loadSettings(getSettingsPath()));
        return result;
      },
      getUpdateSettings: () => getUpdateSettings(getSettingsPath()),
      updateUpdateSettings: async (params) => {
        const result = await updateUpdateSettings(getSettingsPath(), params);
        await updateManager?.restartSchedule();
        return result;
      },
      checkForUpdate: () => {
        const mgr = getUpdateManager();
        return mgr.check();
      },
      applyUpdate: async () => {
        const mgr = getUpdateManager();
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
