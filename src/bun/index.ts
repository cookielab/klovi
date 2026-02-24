import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow } from "electrobun/bun";
import { createRegistry } from "../plugins/auto-discover.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import type { KloviRPC } from "../shared/rpc-types.ts";
import {
  getProjects,
  getSession,
  getSessions,
  getStats,
  getSubAgent,
  getVersion,
  searchSessions,
} from "./rpc-handlers.ts";

let registry: PluginRegistry | null = null;

function getRegistry(): PluginRegistry {
  if (!registry) throw new Error("Risk not accepted yet");
  return registry;
}

const rpc = BrowserView.defineRPC<KloviRPC>({
  handlers: {
    requests: {
      acceptRisks: () => {
        if (!registry) {
          registry = createRegistry();
        }
        return { ok: true };
      },
      getVersion: () => getVersion(),
      getStats: () => getStats(getRegistry()),
      getProjects: () => getProjects(getRegistry()),
      getSessions: (params) => getSessions(getRegistry(), params),
      getSession: (params) => getSession(getRegistry(), params),
      getSubAgent: (params) => getSubAgent(getRegistry(), params),
      searchSessions: () => searchSessions(getRegistry()),
    },
    messages: {},
  },
});

const win = new BrowserWindow({
  title: "Klovi",
  url: "views://main/index.html",
  frame: { x: 100, y: 100, width: 1400, height: 900 },
  rpc,
});

// Application menu
ApplicationMenu.setApplicationMenu([
  {
    submenu: [
      { label: "About Klovi", role: "about" },
      { type: "separator" },
      { label: "Quit Klovi", role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { label: "Toggle Theme", action: "cycleTheme", accelerator: "t" },
      { type: "separator" },
      { label: "Increase Font Size", action: "increaseFontSize", accelerator: "+" },
      { label: "Decrease Font Size", action: "decreaseFontSize", accelerator: "-" },
      { type: "separator" },
      { label: "Toggle Presentation", action: "togglePresentation", accelerator: "p" },
    ],
  },
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }],
  },
]);

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
  }
});
