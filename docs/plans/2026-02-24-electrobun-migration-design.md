# Electrobun Migration Design

## Goal

Migrate Klovi from a CLI web server (`node:http` + browser) to a native desktop app using Electrobun. Replace the HTTP API layer with typed RPC. Target all three platforms (macOS, Linux, Windows).

## Decisions

- **Replace entirely** — no web server mode, native app only
- **RPC directly** — no internal HTTP server, Electrobun typed RPC for all data flow
- **Full migration** — restructure to Electrobun layout in one pass
- **Window + App menu** — native window and custom application menu
- **All platforms** — macOS (native renderer), Linux (CEF), Windows (native/CEF)
- **Downloadable binaries** — drop npm package distribution

## Project Structure

```
Klovi/
├── electrobun.config.ts
├── src/
│   ├── bun/                          # Main process (Bun runtime)
│   │   ├── index.ts                  # Window creation, menu, lifecycle
│   │   └── rpc-handlers.ts           # RPC handler implementations
│   ├── views/
│   │   └── main/
│   │       ├── index.html            # Main webview HTML
│   │       └── index.ts              # Electroview RPC setup + React mount
│   ├── shared/
│   │   ├── types.ts                  # Existing (unchanged)
│   │   ├── plugin-types.ts           # Existing (unchanged)
│   │   ├── content-blocks.ts         # Existing (unchanged)
│   │   ├── session-id.ts             # Existing (unchanged)
│   │   └── rpc-types.ts              # NEW: typed RPC schema
│   ├── plugins/                      # Moved from src/server/plugins/
│   │   ├── shared/
│   │   ├── claude-code/
│   │   ├── codex-cli/
│   │   └── opencode/
│   ├── parser/                       # Moved from src/server/parser/
│   │   ├── session.ts
│   │   ├── command-message.ts
│   │   ├── claude-dir.ts
│   │   ├── stats.ts
│   │   └── types.ts
│   └── frontend/                     # Existing React components (mostly unchanged)
│       ├── App.tsx
│       ├── components/
│       ├── hooks/
│       └── utils/
├── icon.iconset/
└── package.json
```

### Key file moves

| From | To |
|---|---|
| `src/server/plugins/*` | `src/plugins/*` |
| `src/server/parser/*` | `src/parser/*` |
| `src/server/plugin-registry.ts` | `src/plugins/registry.ts` |
| `src/server/registry.ts` | `src/plugins/auto-discover.ts` |
| `src/server/config.ts` | `src/plugins/config.ts` |
| `src/server/iso-time.ts` | `src/shared/iso-time.ts` |

### Deleted files

- `src/server/http.ts` — HTTP server
- `src/server/cli.ts` — CLI parsing, banner, security warning
- `src/server/api/*` — all HTTP API handlers
- `src/server/version.ts` — replaced by Electrobun's BuildConfig
- `scripts/build-server.ts` — npm build script
- `scripts/build-compile.ts` — standalone binary build
- `index.ts` — server entry point
- `index.html` — replaced by `src/views/main/index.html`

## RPC Schema

```typescript
// src/shared/rpc-types.ts
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
      getStats: { params: {}; response: DashboardStats };
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

Each RPC request maps 1:1 to an existing API endpoint. The handler logic is extracted from `src/server/api/*.ts` without HTTP wrapping.

## Main Process

### `src/bun/index.ts`

1. Auto-discover plugins via `createRegistry()` (existing logic)
2. Define RPC handlers that delegate to registry
3. Create `BrowserWindow` loading `views://main/index.html`
4. Set up `ApplicationMenu`:
   - **App**: About, Quit
   - **Edit**: Undo, Redo, Cut, Copy, Paste, Select All (standard roles)
   - **View**: Theme (cycle), Font Size (+/-), Presentation Mode (toggle) — these send RPC messages to the webview
   - **Window**: Minimize, Zoom (standard roles)
5. `exitOnLastWindowClosed: true` in config

### `src/bun/rpc-handlers.ts`

Thin functions wrapping existing logic:

```typescript
// Example
export async function getProjects(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  return { projects };
}
```

## Frontend Changes

### New: `useRPC` hook

Replaces `useFetch`. Same interface: `{ data, loading, error, retry }`.

```typescript
export function useRPC<T>(
  rpcCall: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; loading: boolean; error: string | null; retry: () => void }
```

### Updated files

| File | Change |
|---|---|
| `hooks/useFetch.ts` | Deleted, replaced by `useRPC` |
| `hooks/useSessionData.ts` | Use `useRPC` with `rpc.request.getSession()` |
| `hooks/useFetch.test.ts` | Rewritten for `useRPC` |
| `view-state.ts` | `loadProject()` / `loadProjectSession()` use RPC instead of fetch |
| `App.tsx` | `fetchSearchSessions()` uses RPC; receives menu messages for theme/font/presentation |
| `components/dashboard/DashboardStats.tsx` | Use `useRPC` with `rpc.request.getStats()` |

### Unchanged

All rendering components (`MessageList`, `SessionView`, `ToolCall`, `UserMessage`, `AssistantMessage`, etc.) receive data via props and are unaffected.

## App Menu Integration

The "View" menu actions (theme, font size, presentation) send RPC messages from the Bun process to the webview. The frontend listens for these messages and dispatches the same actions that the current UI buttons trigger.

## Build & Distribution

### `electrobun.config.ts`

```typescript
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
  release: {
    baseUrl: "https://releases.example.com/klovi",
  },
} satisfies ElectrobunConfig;
```

### package.json changes

- Add `electrobun` dependency
- Remove `bin`, `files`, `engines.node` fields
- Update scripts: `dev` → `electrobun dev`, `build` → `electrobun build`
- Remove `build:frontend`, `build:server`, `build:compile` scripts

## Testing

| Category | Impact |
|---|---|
| Plugin/parser tests | Unchanged (pure data logic) |
| Frontend component tests | Unchanged (render with static props) |
| `useFetch` tests | Rewritten as `useRPC` tests |
| Server API tests | Deleted or converted to RPC handler unit tests |
| `version.test.ts` | Deleted (version comes from Electrobun BuildConfig) |

## Migration Sequence

1. Install Electrobun, create config
2. Move files to new structure (plugins, parser, shared)
3. Create RPC schema
4. Implement main process (window, menu, RPC handlers)
5. Create webview entry (HTML + Electroview setup)
6. Replace frontend `useFetch`/`fetch` with RPC
7. Wire up menu actions via RPC messages
8. Update tests
9. Remove old server files
10. Update package.json, README, docs
