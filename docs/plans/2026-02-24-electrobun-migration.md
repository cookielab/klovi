# Electrobun Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Klovi from a CLI web server to a native desktop app using Electrobun with typed RPC.

**Architecture:** The Bun main process hosts plugin/parser data logic and exposes it via typed RPC. A BrowserWindow loads the React frontend as a webview. The HTTP server layer is completely removed.

**Tech Stack:** Electrobun, Bun, React 19, TypeScript strict mode, Biome, bun:test

**Design doc:** `docs/plans/2026-02-24-electrobun-migration-design.md`

---

### Task 1: Install Electrobun and Create Config

**Files:**
- Modify: `package.json`
- Create: `electrobun.config.ts`

**Step 1: Install electrobun**

Run: `bun add electrobun`

**Step 2: Create electrobun.config.ts**

```typescript
import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Klovi",
    identifier: "io.cookielab.klovi",
    version: "2.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      main: {
        entrypoint: "src/views/main/index.ts",
      },
    },
    copy: {
      "src/views/main/index.html": "views/main/index.html",
      "src/frontend/App.css": "views/main/App.css",
      "src/frontend/index.css": "views/main/index.css",
    },
    mac: {
      defaultRenderer: "native",
      icons: "icon.iconset",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      defaultRenderer: "native",
    },
  },
} satisfies ElectrobunConfig;
```

**Step 3: Update package.json scripts**

Remove `bin`, `files`, `engines.node` fields. Update scripts:

```json
{
  "scripts": {
    "dev": "bunx electrobun dev",
    "build": "bunx electrobun build",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "bunx biome lint .",
    "format": "bunx biome format --write .",
    "check": "bunx biome check .",
    "check:fix": "bunx biome check --write ."
  }
}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: May have errors from not-yet-created files — that's fine at this stage.

**Step 5: Commit**

```bash
git add electrobun.config.ts package.json bun.lockb
git commit -m "chore: add electrobun dependency and config"
```

---

### Task 2: Move Files to New Structure

This task moves data logic out of `src/server/` to platform-neutral locations. No code changes — just file moves and import path updates.

**Moves:**
- `src/server/plugins/` → `src/plugins/`
- `src/server/parser/` → `src/parser/`
- `src/server/plugin-registry.ts` → `src/plugins/registry.ts`
- `src/server/plugin-registry.test.ts` → `src/plugins/registry.test.ts`
- `src/server/registry.ts` → `src/plugins/auto-discover.ts`
- `src/server/config.ts` → `src/plugins/config.ts`
- `src/server/iso-time.ts` → `src/shared/iso-time.ts`
- `src/server/iso-time.test.ts` → `src/shared/iso-time.test.ts`

**Step 1: Move plugin files**

```bash
git mv src/server/plugins src/plugins
git mv src/server/plugin-registry.ts src/plugins/registry.ts
git mv src/server/plugin-registry.test.ts src/plugins/registry.test.ts
git mv src/server/registry.ts src/plugins/auto-discover.ts
git mv src/server/config.ts src/plugins/config.ts
```

**Step 2: Move parser files**

```bash
git mv src/server/parser src/parser
```

**Step 3: Move shared utils**

```bash
git mv src/server/iso-time.ts src/shared/iso-time.ts
git mv src/server/iso-time.test.ts src/shared/iso-time.test.ts
```

**Step 4: Fix all import paths**

Update every file that imported from the old locations. Key patterns to search and replace:

- `../server/plugins/` → `../plugins/` or adjusted relative path
- `./plugin-registry.ts` → adjusted path
- `./plugins/` → adjusted path
- `../parser/` → adjusted path
- `./iso-time.ts` → adjusted path
- `../server/config.ts` → adjusted path

Files to update (search for all `server/` imports):
- `src/plugins/registry.ts` — imports from `./iso-time.ts` → `../shared/iso-time.ts`, from `../shared/` → stays, from `./plugins/` → `./`
- `src/plugins/auto-discover.ts` — imports from `./plugin-registry.ts` → `./registry.ts`, from `./plugins/` → `./`
- `src/plugins/claude-code/index.ts` — imports from `../config.ts` → adjust
- `src/plugins/codex-cli/index.ts` — imports from `../config.ts` → adjust
- `src/plugins/opencode/index.ts` — imports from `../config.ts` → adjust
- `src/plugins/claude-code/parser.ts` — imports from `../../parser/` → adjust
- `src/parser/session.ts` — may import from `./types.ts` (no change)
- `src/parser/stats.ts` — imports from config
- `src/frontend/plugin-registry.ts` — imports from `../server/plugins/codex-cli/extractors.ts` → `../plugins/codex-cli/extractors.ts`, same for opencode
- All test files in moved directories — update their relative imports

Use `bun run typecheck` after each batch of updates to verify correctness.

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass (ignore any failures in `src/server/api/` test files and `src/server/version.test.ts` which will be deleted in a later task).

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move plugins/parser/config to platform-neutral locations"
```

---

### Task 3: Create RPC Type Schema

**Files:**
- Create: `src/shared/rpc-types.ts`

**Step 1: Create the RPC types file**

```typescript
import type { RPCSchema } from "electrobun/bun";
import type {
  DashboardStats,
  GlobalSessionResult,
  Project,
  Session,
  SessionSummary,
} from "./types.ts";

export interface VersionInfo {
  version: string;
  commit: string;
}

export type KloviRPC = {
  bun: RPCSchema<{
    requests: {
      getVersion: { params: {}; response: VersionInfo };
      getStats: { params: {}; response: { stats: DashboardStats } };
      getProjects: { params: {}; response: { projects: Project[] } };
      getSessions: {
        params: { encodedPath: string };
        response: { sessions: SessionSummary[] };
      };
      getSession: {
        params: { sessionId: string; project: string };
        response: { session: Session };
      };
      getSubAgent: {
        params: { sessionId: string; project: string; agentId: string };
        response: { session: Session };
      };
      searchSessions: {
        params: {};
        response: { sessions: GlobalSessionResult[] };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      cycleTheme: {};
      increaseFontSize: {};
      decreaseFontSize: {};
      togglePresentation: {};
    };
  }>;
};
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Pass (schema is a type-only file).

**Step 3: Commit**

```bash
git add src/shared/rpc-types.ts
git commit -m "feat: add typed RPC schema for Electrobun"
```

---

### Task 4: Implement RPC Handlers

**Files:**
- Create: `src/bun/rpc-handlers.ts`
- Create: `src/bun/rpc-handlers.test.ts`

**Step 1: Write the RPC handlers test**

```typescript
import { describe, expect, test } from "bun:test";
// Tests for RPC handler functions that extract logic from HTTP handlers.
// These test the pure data logic, not Electrobun RPC wiring.

// Import will work after Step 3
import { getVersion } from "./rpc-handlers.ts";

describe("rpc-handlers", () => {
  test("getVersion returns version info", () => {
    const result = getVersion();
    expect(result).toHaveProperty("version");
    expect(typeof result.version).toBe("string");
    expect(result).toHaveProperty("commit");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/bun/rpc-handlers.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement rpc-handlers.ts**

Extract the logic from current `src/server/api/*.ts` handlers, stripping the `Response.json()` wrapper. The handlers take a `PluginRegistry` parameter and return plain objects.

```typescript
import { encodeSessionId, parseSessionId } from "../shared/session-id.ts";
import type { VersionInfo } from "../shared/rpc-types.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import { scanStats } from "../parser/stats.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
} from "../plugins/claude-code/parser.ts";
import { sortByIsoDesc } from "../shared/iso-time.ts";
import { parseSubAgentSession } from "../plugins/claude-code/parser.ts";
import type { GlobalSessionResult, Session, SessionSummary } from "../shared/types.ts";

export function getVersion(): VersionInfo {
  return {
    version: process.env.KLOVI_VERSION ?? "dev",
    commit: process.env.KLOVI_COMMIT ?? "",
  };
}

export async function getStats() {
  const stats = await scanStats();
  return { stats };
}

export async function getProjects(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  return { projects };
}

export async function getSessions(
  registry: PluginRegistry,
  params: { encodedPath: string },
) {
  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.encodedPath);
  if (!project) return { sessions: [] as SessionSummary[] };
  const sessions = await registry.listAllSessions(project);
  return { sessions };
}

export async function getSession(
  registry: PluginRegistry,
  params: { sessionId: string; project: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (!parsed.pluginId || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format");
  }

  const pluginId = parsed.pluginId;
  const rawSessionId = parsed.rawSessionId;

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.project);
  if (!project) throw new Error("Project not found");

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) throw new Error("Plugin source not found");

  const plugin = registry.getPlugin(pluginId);

  if (pluginId === "claude-code") {
    const [{ session, slug }, sessions] = await Promise.all([
      loadClaudeSession(source.nativeId, rawSessionId),
      plugin.listSessions(source.nativeId),
    ]);

    const planRawId = findPlanSessionId(session.turns, slug, sessions, rawSessionId);
    const implRawId = findImplSessionId(slug, sessions, rawSessionId);

    session.sessionId = encodeSessionId(pluginId, rawSessionId);
    session.planSessionId = planRawId ? encodeSessionId(pluginId, planRawId) : undefined;
    session.implSessionId = implRawId ? encodeSessionId(pluginId, implRawId) : undefined;

    return { session };
  }

  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.sessionId = encodeSessionId(pluginId, rawSessionId);
  session.pluginId = pluginId;
  return { session };
}

export async function getSubAgent(
  registry: PluginRegistry,
  params: { sessionId: string; project: string; agentId: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (parsed.pluginId !== "claude-code" || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format for sub-agent");
  }
  const session = await parseSubAgentSession(parsed.rawSessionId, params.project, params.agentId);
  return { session };
}

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export async function searchSessions(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  const allSessions: GlobalSessionResult[] = [];

  for (const project of projects) {
    const sessions = await registry.listAllSessions(project);
    const projectName = projectNameFromPath(project.name);
    for (const session of sessions) {
      allSessions.push({
        ...session,
        encodedPath: project.encodedPath,
        projectName,
      });
    }
  }

  sortByIsoDesc(allSessions, (session) => session.timestamp);
  return { sessions: allSessions };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/bun/rpc-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/bun/rpc-handlers.ts src/bun/rpc-handlers.test.ts
git commit -m "feat: implement RPC handler functions"
```

---

### Task 5: Create Bun Main Process Entry

**Files:**
- Create: `src/bun/index.ts`

**Step 1: Implement main process**

```typescript
import { ApplicationMenu, BrowserView, BrowserWindow } from "electrobun/bun";
import type { KloviRPC } from "../shared/rpc-types.ts";
import { createRegistry } from "../plugins/auto-discover.ts";
import {
  getVersion,
  getStats,
  getProjects,
  getSessions,
  getSession,
  getSubAgent,
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
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
    ],
  },
]);

// Forward menu actions to webview as RPC messages
import Electrobun from "electrobun/bun";

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
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Pass (or minor issues from Electrobun types to resolve).

**Step 3: Commit**

```bash
git add src/bun/index.ts
git commit -m "feat: implement Electrobun main process with window and menu"
```

---

### Task 6: Create Webview Entry Point

**Files:**
- Create: `src/views/main/index.html`
- Create: `src/views/main/index.ts`

**Step 1: Create index.html**

This replaces the root `index.html`. It's the HTML loaded by the BrowserWindow.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Klovi</title>
    <link rel="stylesheet" href="./App.css" />
    <link rel="stylesheet" href="./index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.ts"></script>
  </body>
</html>
```

Note: Font imports (`@fontsource/*`) need to be included. Check if Electrobun's bundler handles node_modules CSS or if fonts need to be copied. This may need the `copy` config to include font files, or fonts can be imported in `index.ts`.

**Step 2: Create index.ts (Electroview + React mount)**

```typescript
import { Electroview } from "electrobun/view";
import { createRoot } from "react-dom/client";
import type { KloviRPC } from "../../shared/rpc-types.ts";
import { App } from "../../frontend/App.tsx";

// Import fonts
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

// Import styles
import "../../frontend/index.css";
import "../../frontend/App.css";

const rpc = Electroview.defineRPC<KloviRPC>({
  handlers: {
    requests: {},
    messages: {
      cycleTheme: () => {
        window.dispatchEvent(new CustomEvent("klovi:cycleTheme"));
      },
      increaseFontSize: () => {
        window.dispatchEvent(new CustomEvent("klovi:increaseFontSize"));
      },
      decreaseFontSize: () => {
        window.dispatchEvent(new CustomEvent("klovi:decreaseFontSize"));
      },
      togglePresentation: () => {
        window.dispatchEvent(new CustomEvent("klovi:togglePresentation"));
      },
    },
  },
});

export const electroview = new Electroview({ rpc });

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

Note: The `App` component needs to be exported as a named export from `App.tsx` (currently it mounts itself). This will be updated in Task 8.

**Step 3: Commit**

```bash
git add src/views/main/index.html src/views/main/index.ts
git commit -m "feat: create Electrobun webview entry point"
```

---

### Task 7: Create useRPC Hook

**Files:**
- Create: `src/frontend/hooks/useRPC.ts`
- Create: `src/frontend/hooks/useRPC.test.ts`

**Step 1: Write the failing test**

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useRPC } from "./useRPC.ts";

describe("useRPC", () => {
  afterEach(() => {
    cleanup();
  });

  test("starts in loading state", () => {
    const rpcCall = () => new Promise<{ value: number }>(() => {});
    const { result } = renderHook(() => useRPC(rpcCall, []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("returns data on successful call", async () => {
    const rpcCall = () => Promise.resolve({ value: 42 });
    const { result } = renderHook(() => useRPC(rpcCall, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
  });

  test("returns error on failure", async () => {
    const rpcCall = () => Promise.reject(new Error("RPC failed"));
    const { result } = renderHook(() => useRPC(rpcCall, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC failed");
    expect(result.current.data).toBeNull();
  });

  test("retry refetches data", async () => {
    let callCount = 0;
    const rpcCall = () => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("fail"));
      return Promise.resolve({ ok: true });
    };

    const { result } = renderHook(() => useRPC(rpcCall, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("fail");

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/frontend/hooks/useRPC.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement useRPC**

```typescript
import { type DependencyList, useCallback, useEffect, useState } from "react";

interface UseRPCResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useRPC<T>(
  rpcCall: () => Promise<T>,
  deps: DependencyList,
): UseRPCResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount triggers refetch on retry(); deps array is spread from caller
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    rpcCall()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount, ...deps]);

  return { data, loading, error, retry };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/frontend/hooks/useRPC.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/frontend/hooks/useRPC.ts src/frontend/hooks/useRPC.test.ts
git commit -m "feat: add useRPC hook replacing useFetch"
```

---

### Task 8: Create RPC Client Module + Refactor App.tsx

**Files:**
- Create: `src/frontend/rpc.ts`
- Modify: `src/frontend/App.tsx`

**Step 1: Create rpc.ts — the frontend RPC client**

This module provides the `rpc` object for the frontend. In the Electrobun runtime it's backed by the real Electroview. In tests, it can be mocked.

```typescript
// This module is imported by frontend components to make RPC calls.
// The actual Electroview instance is set up in src/views/main/index.ts
// and injected here.

import type { KloviRPC } from "../shared/rpc-types.ts";

type RPCRequests = KloviRPC["bun"]["requests"];

export interface RPCClient {
  request: {
    [K in keyof RPCRequests]: (
      params: RPCRequests[K]["params"],
    ) => Promise<RPCRequests[K]["response"]>;
  };
}

let rpcClient: RPCClient | null = null;

export function setRPCClient(client: RPCClient): void {
  rpcClient = client;
}

export function getRPC(): RPCClient {
  if (!rpcClient) throw new Error("RPC client not initialized");
  return rpcClient;
}
```

The `src/views/main/index.ts` calls `setRPCClient(electroview.rpc)` after Electroview initialization.

**Step 2: Refactor App.tsx — export App, remove self-mount**

The current `App.tsx` both defines `App` and calls `createRoot().render()`. Split these:

- Export `App` as a named export
- Remove the `createRoot` / `render` call at the bottom (mounting moves to `src/views/main/index.ts`)

Also update App to listen for menu custom events:

```tsx
// Add to App() function body, alongside existing useEffect hooks:

// Listen for menu actions from Electrobun
useEffect(() => {
  const handleCycleTheme = () => cycleTheme();
  const handleIncrease = () => increase();
  const handleDecrease = () => decrease();
  const handleTogglePresentation = () => {
    if (canPresent) togglePresentation();
  };

  window.addEventListener("klovi:cycleTheme", handleCycleTheme);
  window.addEventListener("klovi:increaseFontSize", handleIncrease);
  window.addEventListener("klovi:decreaseFontSize", handleDecrease);
  window.addEventListener("klovi:togglePresentation", handleTogglePresentation);

  return () => {
    window.removeEventListener("klovi:cycleTheme", handleCycleTheme);
    window.removeEventListener("klovi:increaseFontSize", handleIncrease);
    window.removeEventListener("klovi:decreaseFontSize", handleDecrease);
    window.removeEventListener("klovi:togglePresentation", handleTogglePresentation);
  };
}, [cycleTheme, increase, decrease, canPresent, togglePresentation]);
```

Update `fetchSearchSessions` to use RPC:

```tsx
import { getRPC } from "./rpc.ts";

const fetchSearchSessions = useCallback(() => {
  getRPC()
    .request.searchSessions({})
    .then((data) => setSearchSessions(data.sessions))
    .catch(() => {});
}, []);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: Pass.

**Step 4: Commit**

```bash
git add src/frontend/rpc.ts src/frontend/App.tsx
git commit -m "feat: create RPC client module, refactor App for Electrobun"
```

---

### Task 9: Migrate Frontend Components to useRPC

**Files:**
- Modify: `src/frontend/hooks/useSessionData.ts`
- Modify: `src/frontend/components/dashboard/DashboardStats.tsx`
- Modify: `src/frontend/components/layout/Sidebar.tsx`
- Modify: `src/frontend/components/project/ProjectList.tsx`
- Modify: `src/frontend/components/project/SessionList.tsx`
- Modify: `src/frontend/components/project/HiddenProjectList.tsx`
- Modify: `src/frontend/view-state.ts`

**Step 1: Update useSessionData.ts**

Replace `useFetch` with `useRPC` + `getRPC()`:

```typescript
import type { Session } from "../../shared/types.ts";
import { getRPC } from "../rpc.ts";
import { useRPC } from "./useRPC.ts";

export function useSessionData(sessionId: string, project: string) {
  return useRPC<{ session: Session }>(
    () => getRPC().request.getSession({ sessionId, project }),
    [sessionId, project],
  );
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
  return useRPC<{ session: Session }>(
    () => getRPC().request.getSubAgent({ sessionId, project, agentId }),
    [sessionId, project, agentId],
  );
}
```

**Step 2: Update DashboardStats.tsx**

Replace `useFetch<{ stats: Stats }>("/api/stats", [])` with:

```typescript
import { useRPC } from "../../hooks/useRPC.ts";
import { getRPC } from "../../rpc.ts";

const { data, loading, error, retry } = useRPC<{ stats: Stats }>(
  () => getRPC().request.getStats({}),
  [],
);
```

**Step 3: Update Sidebar.tsx**

Replace `useFetch<VersionInfo>("/api/version", [])` with:

```typescript
import { useRPC } from "../../hooks/useRPC.ts";
import { getRPC } from "../../rpc.ts";

const { data: versionInfo } = useRPC<VersionInfo>(
  () => getRPC().request.getVersion({}),
  [],
);
```

**Step 4: Update ProjectList.tsx**

Replace `useFetch<{ projects: Project[] }>("/api/projects", [])` with:

```typescript
import { useRPC } from "../../hooks/useRPC.ts";
import { getRPC } from "../../rpc.ts";

const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(
  () => getRPC().request.getProjects({}),
  [],
);
```

**Step 5: Update SessionList.tsx**

Replace `useFetch<{ sessions: SessionSummary[] }>("/api/projects/...", [...])` with:

```typescript
import { useRPC } from "../../hooks/useRPC.ts";
import { getRPC } from "../../rpc.ts";

const { data, loading, error, retry } = useRPC<{ sessions: SessionSummary[] }>(
  () => getRPC().request.getSessions({ encodedPath: project.encodedPath }),
  [project.encodedPath],
);
```

**Step 6: Update HiddenProjectList.tsx**

Replace `useFetch<{ projects: Project[] }>("/api/projects", [])` with:

```typescript
import { useRPC } from "../../hooks/useRPC.ts";
import { getRPC } from "../../rpc.ts";

const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(
  () => getRPC().request.getProjects({}),
  [],
);
```

**Step 7: Update view-state.ts**

Replace `fetch("/api/projects")` and `fetch("/api/projects/.../sessions")` with RPC calls:

```typescript
import { getRPC } from "./rpc.ts";

async function loadProject(encodedPath: string): Promise<Project | undefined> {
  const data = await getRPC().request.getProjects({});
  return data.projects.find((p) => p.encodedPath === encodedPath);
}

async function loadProjectSession(
  project: Project,
  sessionId: string,
): Promise<SessionSummary | undefined> {
  const data = await getRPC().request.getSessions({ encodedPath: project.encodedPath });
  return data.sessions.find((s) => s.sessionId === sessionId);
}
```

**Step 8: Run typecheck**

Run: `bun run typecheck`
Expected: Pass.

**Step 9: Commit**

```bash
git add src/frontend/hooks/useSessionData.ts src/frontend/components/ src/frontend/view-state.ts
git commit -m "feat: migrate all frontend components from fetch to RPC"
```

---

### Task 10: Update Frontend Tests

**Files:**
- Delete: `src/frontend/hooks/useFetch.ts`
- Delete: `src/frontend/hooks/useFetch.test.ts`
- Modify: `src/frontend/components/dashboard/DashboardStats.test.tsx`
- Modify: `src/frontend/components/layout/Sidebar.test.tsx`
- Modify: `src/frontend/components/project/ProjectList.test.tsx`
- Modify: `src/frontend/components/project/SessionList.test.tsx` (if it mocks fetch)
- Modify: `src/frontend/components/project/HiddenProjectList.test.tsx` (if it mocks fetch)

**Step 1: Check which component tests mock fetch**

Read each test file. Component tests that render with static props don't need changes. Tests that mock `fetch` or use `useFetch` internally need updating to mock the RPC client instead.

The pattern for mocking RPC in tests:

```typescript
import { setRPCClient } from "../../rpc.ts";

// Create a mock RPC client
function mockRPC(overrides: Partial<RPCClient["request"]> = {}) {
  setRPCClient({
    request: {
      getVersion: () => Promise.resolve({ version: "1.0.0", commit: "abc123" }),
      getStats: () => Promise.resolve({ stats: { /* ... */ } }),
      getProjects: () => Promise.resolve({ projects: [] }),
      getSessions: () => Promise.resolve({ sessions: [] }),
      getSession: () => Promise.resolve({ session: {} }),
      getSubAgent: () => Promise.resolve({ session: {} }),
      searchSessions: () => Promise.resolve({ sessions: [] }),
      ...overrides,
    } as RPCClient["request"],
  });
}
```

**Step 2: Delete useFetch files**

```bash
git rm src/frontend/hooks/useFetch.ts src/frontend/hooks/useFetch.test.ts
```

**Step 3: Update component tests that used fetch mocking**

For each component test file, replace `mockFetch(...)` patterns with `mockRPC(...)` / `setRPCClient(...)` patterns. The specifics depend on what each test does — read each test file and update accordingly.

**Step 4: Run all tests**

Run: `bun test`
Expected: All pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "test: migrate frontend tests from fetch mocking to RPC mocking"
```

---

### Task 11: Delete Old Server Files

**Files:**
- Delete: `src/server/http.ts`
- Delete: `src/server/cli.ts`
- Delete: `src/server/version.ts`
- Delete: `src/server/version.test.ts`
- Delete: `src/server/api/` (entire directory)
- Delete: `index.ts` (old server entry)
- Delete: `index.html` (old HTML template)
- Delete: `scripts/build-server.ts`
- Delete: `scripts/build-compile.ts`

**Step 1: Remove old files**

```bash
git rm src/server/http.ts src/server/cli.ts src/server/version.ts src/server/version.test.ts
git rm -r src/server/api/
git rm index.ts index.html
git rm scripts/build-server.ts scripts/build-compile.ts
```

If `src/server/` directory is now empty, remove it:

```bash
rmdir src/server 2>/dev/null || true
```

**Step 2: Update package.json**

Remove the `bin`, `files`, `engines.node` fields. The `module` field can be removed too since this is no longer an npm package entry.

**Step 3: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass. No remaining imports to deleted files.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old HTTP server, CLI, and build scripts"
```

---

### Task 12: Wire Up Electroview in views/main/index.ts

**Files:**
- Modify: `src/views/main/index.ts`

**Step 1: Update index.ts to set up the RPC client**

After the Electroview is constructed, inject it as the frontend RPC client:

```typescript
import { setRPCClient } from "../../frontend/rpc.ts";

// ... after electroview construction ...
setRPCClient(electroview.rpc);
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Pass.

**Step 3: Commit**

```bash
git add src/views/main/index.ts
git commit -m "feat: wire Electroview RPC client into frontend"
```

---

### Task 13: Manual Smoke Test

**Step 1: Build the app**

Run: `bunx electrobun dev`

**Step 2: Verify**

- Window opens with Klovi UI
- Project list loads in sidebar
- Click a project → sessions load
- Click a session → session view renders messages
- App menu → View → Toggle Theme works
- App menu → View → Font size +/- works
- Cmd+K → search modal opens and shows results
- Presentation mode works (press `p` on a session)

**Step 3: Fix any issues found**

Address runtime errors, missing assets, or RPC wiring issues.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from smoke testing"
```

---

### Task 14: Run Full Verification

**Step 1: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 2: Commit final state if needed**

---

### Task 15: Update Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update architecture.md**

Replace the server section with the Electrobun main process description. Update the project structure tree, data flow diagram, and component hierarchy. Remove HTTP route table, CLI flags. Add RPC schema reference.

**Step 2: Update README.md**

Update install/usage instructions: no longer `bunx @cookielab.io/klovi`, now download the binary. Update build instructions to use `bunx electrobun build`.

**Step 3: Update CLAUDE.md**

Update the dev command from `bun run dev` to `bunx electrobun dev`. Update build references.

**Step 4: Commit**

```bash
git add docs/architecture.md README.md CLAUDE.md
git commit -m "docs: update documentation for Electrobun migration"
```
