import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow } from "electrobun/bun";
import { createRegistry } from "../plugins/auto-discover.ts";
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

const registry = createRegistry();

const rpc = BrowserView.defineRPC<KloviRPC>({
  handlers: {
    requests: {
      getVersion: () => getVersion(),
      getStats: () => getStats(),
      getProjects: () => getProjects(registry),
      getSessions: (params) => getSessions(registry, params),
      getSession: (params) => getSession(registry, params),
      getSubAgent: (params) => getSubAgent(registry, params),
      searchSessions: () => searchSessions(registry),
    },
    messages: {},
  },
});

const win = new BrowserWindow({
  title: "Klovi",
  url: "views://main/index.html",
  frame: { width: 1400, height: 900 },
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
  switch (e.data.action) {
    case "cycleTheme":
      win.webview.rpc.send.cycleTheme({});
      break;
    case "increaseFontSize":
      win.webview.rpc.send.increaseFontSize({});
      break;
    case "decreaseFontSize":
      win.webview.rpc.send.decreaseFontSize({});
      break;
    case "togglePresentation":
      win.webview.rpc.send.togglePresentation({});
      break;
  }
});
