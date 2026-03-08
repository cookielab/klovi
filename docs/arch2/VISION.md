# Klovi Architecture Vision

## Product Goal

Klovi is a tool for browsing and presenting AI coding session history. It supports two distribution modes that share the same core UI and backend logic:

- **Desktop App** — native installer per platform (macOS arm64 `.dmg`, Windows x64 `.exe`, Linux amd64+arm64 `.AppImage`). Bundles everything it needs. Uses Electrobun as the native shell, `apps/web` for the UI, and `apps/server` for the backend. Supports native-only features: directory browsing, auto-updates, menu actions.
- **NPM Package** — `npx @cookielab.io/klovi` or `bunx @cookielab.io/klovi`. A single published package that starts the backend, serves the web UI, and opens the user's browser. Works under both Node and Bun runtimes.

## Repository Layout

```
apps/
  server/      internal — backend API, Effect-based, dual runtime (Bun + Node)
  web/         internal — shared React UI, mountKloviApp(), bridge contracts
  package/     published — @cookielab.io/klovi, wires server + web, CLI entrypoint
  desktop/     standalone — Electrobun shell, wires server + web with native capabilities

packages/
  klovi-plugin-core/          plugin contracts and registry primitives
  klovi-plugin-claude-code/   Claude Code discovery, parsing, frontend integration
  klovi-plugin-codex/         Codex discovery, parsing, frontend integration
  klovi-plugin-opencode/      OpenCode discovery, parsing, frontend integration
  klovi-ui/                   reusable feature UI (message, session, search, tool rendering)
  klovi-design-system/        design tokens, UI primitives, global styles, theme hooks
```

### Dependency Rules

- `apps/server` depends on `packages/*` only. It has no dependency on `apps/web`.
- `apps/web` depends on `packages/*` only. It has no dependency on `apps/server`.
- `apps/package` depends on `apps/server` and `apps/web`. It owns the HTTP composition layer.
- `apps/desktop` depends on `apps/server` and `apps/web`. It owns the Electrobun composition layer.
- No package under `packages/` depends on anything under `apps/`.

## Runtime Architecture

### NPM Mode

```
User runs: npx @cookielab.io/klovi (Node) or bunx @cookielab.io/klovi (Bun)

apps/package CLI
  |
  +-- starts apps/server via startKloviServer()
  |
  +-- composes HTTP routing:
  |     /api/*  --> apps/server API handlers
  |     /*      --> apps/web built assets (SPA fallback to index.html)
  |
  +-- opens browser to http://127.0.0.1:<port>
  |
  Browser loads apps/web
    |
    +-- mountKloviApp() with:
          client:     HTTP-backed KloviClient (POST /api/rpc/:method)
          hostBridge: browser KloviHostBridge (desktop capabilities gated off)
```

### Desktop Mode

```
User launches Klovi.app / klovi.exe / Klovi.AppImage

Electrobun (apps/desktop)
  |
  +-- starts apps/server via startKloviServer() in embedded mode
  |
  +-- loads apps/web in Electrobun webview
  |
  +-- mountKloviApp() with:
        client:     HTTP-backed KloviClient (POST /api/rpc/:method against local server)
        hostBridge: Electrobun-backed KloviHostBridge (full native capabilities)
```

### What Each Distribution App Owns

**`apps/package`** owns:
- The CLI entrypoint (`klovi` bin)
- HTTP routing composition: `/api/*` routes to server, `/*` serves web assets
- SPA fallback to `index.html` for client-side routing
- Browser launch after server start
- Published as `@cookielab.io/klovi`

**`apps/desktop`** owns:
- Electrobun window creation, menu integration, updater lifecycle
- Native host bridge implementation (directory browse, updates, menu actions, open external)
- Electrobun webview loading of `apps/web`
- Embedded server startup

Neither `apps/server` nor `apps/web` knows how it is being composed or served.

## Key Contracts

### `mountKloviApp(config)` — apps/web

Single entry point for mounting the shared React application. Both distribution modes call this with runtime-specific wiring.

Config shape:
- `container: HTMLElement` — DOM element to render into
- `client: KloviClient` — server-backed operations
- `hostBridge: KloviHostBridge` — native capabilities (real or stub)
- `initialUrl?: string` — optional initial route

Source: `apps/web/src/bootstrap.tsx`

### `KloviClient` — apps/web

Transport-neutral interface for all server-backed data operations: projects, sessions, stats, search, plugin settings, general settings, version info.

The browser and desktop implementations both use HTTP (`POST /api/rpc/:method`) to talk to the server started by their respective distribution app.

Source: `apps/web/src/lib/client.ts`

### `KloviHostBridge` — apps/web

Interface for desktop-native capabilities. The browser implementation stubs out unsupported operations. The desktop implementation delegates to Electrobun RPC.

Source: `apps/web/src/lib/host-bridge.ts`

### `KloviHostCapabilities` — apps/web

Feature flags checked by the shared UI to gate desktop-only features (`desktop`, `browseDirectory`, `updater`, `menuActions`). The UI branches on these flags instead of checking runtime globals.

Source: `apps/web/src/lib/host-bridge.ts`

### `startKloviServer(options)` — apps/server

Starts the backend API server. Returns `{ url, stop() }`. Both distribution apps call this to start the server.

Key options:
- `host`, `port` — binding address
- `mode` — `"standalone"` or `"embedded"`
- `runtime` — `"auto" | "bun" | "node"` (auto-detected by default)
- `openBrowser` — whether to launch browser (used by `apps/package`, not desktop)

Source: `apps/server/src/server.ts`

### `POST /api/rpc/:method` — apps/server

HTTP transport for server-backed operations. JSON request/response. One route per method. No desktop-native functionality is exposed here.

The HTTP routing that maps `/api/*` to these handlers lives in the distribution app (`apps/package` or `apps/desktop`), not in `apps/server` itself.

## Dual Runtime Support

The server runs on both Bun and Node through `@effect/platform`:

- Shared server logic uses Effect services (`FileSystem`, `Path`, `HttpServer`) — no Bun or Node globals.
- Bun adapter: `@effect/platform-bun` — used when invoked via `bunx` or from Electrobun.
- Node adapter: `@effect/platform-node` — used when invoked via `npx`.
- Runtime is auto-detected (`typeof globalThis.Bun !== "undefined"`) or explicitly selected.

Source: `apps/server/src/effect/platform-bun.ts`, `apps/server/src/effect/platform-node.ts`

## Current State

The three-app split is already in place:

- `apps/server` exists with Effect-based services, dual runtime adapters, CLI, and `startKloviServer()`. Currently holds the `@cookielab.io/klovi` package name and includes static file serving + HTTP routing that should move to `apps/package`.
- `apps/web` exists with `mountKloviApp()`, `KloviClient`, `KloviHostBridge`, capability gating, and the full shared React UI.
- `apps/desktop` exists with Electrobun shell, native host bridge, and embedded server startup.
- All six `packages/*` are in place and functional.

### Remaining Work

- Create `apps/package` as the published `@cookielab.io/klovi` package.
- Move HTTP routing composition (`/api/*` + static serving + SPA fallback) from `apps/server` into `apps/package`.
- Move the `@cookielab.io/klovi` package name and CLI entrypoint from `apps/server` to `apps/package`.
- Make `apps/server` a pure internal backend package with no static file serving and no dependency on `apps/web`.
- Complete the Effect platform migration so all server modules are runtime-neutral (plans 13-19 in `docs/arch2/plans/`).
- Verify desktop embedding still works after the server package is restructured.
- Verify `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` both work end-to-end.

## Constraints

- No caching of any kind (no in-memory, file-based, HTTP, memoization, or TTL caches).
- No new packages under `packages/`.
- Electrobun stays as the desktop runtime.
- Bun is the primary toolchain for building, testing, and linting.
- Existing `packages/*` must not be collapsed into app-local code.
- Browser mode defaults to localhost-only (`127.0.0.1`).
- After every change: `bun run check`, `bun run typecheck`, `bun test`.
