# Klovi Architecture Vision

## Product Goal

Klovi is a tool for browsing and presenting AI coding session history. It supports two distribution modes that share the same core UI and backend logic:

- **Desktop App** — native installer per platform (macOS arm64 `.dmg`, Windows x64 `.exe`, Linux amd64+arm64 `.AppImage`). Bundles everything it needs. Uses Electrobun as the native shell, `packages/ui` for the UI, and `packages/server` for the backend. Supports native-only features: directory browsing, auto-updates, menu actions.
- **NPM Package** — `npx @cookielab.io/klovi` or `bunx @cookielab.io/klovi`. A single published package that starts the backend, serves the web UI, and opens the user's browser. Only `@cookielab.io/klovi` is published to npm; internal workspace packages stay internal and are bundled into the final publish artifact.

## Repository Layout

```
apps/
  package/     only npm publish target — @cookielab.io/klovi, wires server + ui, CLI entrypoint
  desktop/     standalone — Electrobun shell, wires server + ui with native capabilities

packages/
  server/              internal backend API, Effect-based, dual runtime (Bun + Node)
  ui/                  shared React UI, mountKloviApp(), bridge contracts
  plugin-core/         plugin contracts and registry primitives
  plugin-claude-code/  Claude Code discovery, parsing, frontend integration
  plugin-codex/        Codex discovery, parsing, frontend integration
  plugin-opencode/     OpenCode discovery, parsing, frontend integration
  ui-components/       reusable feature UI (message, session, search, tool rendering)
  design-system/       design tokens, UI primitives, global styles, theme hooks
```

### Dependency Rules

- `packages/server` depends on `packages/*` only. It has no dependency on `packages/ui`.
- `packages/ui` depends on `packages/*` only. It has no dependency on `packages/server`.
- `apps/package` depends on `packages/server` and `packages/ui`. It owns the HTTP composition layer and the npm publish artifact staging flow.
- `apps/desktop` depends on `packages/server` and `packages/ui`. It owns the Electrobun composition layer.
- No package under `packages/` depends on anything under `apps/`.
- Only `apps/package` is intended to produce an npm-distributed artifact. Everything under `packages/` is internal implementation code.

## Runtime Architecture

### NPM Mode

```
User runs: npx @cookielab.io/klovi (Node) or bunx @cookielab.io/klovi (Bun)

published @cookielab.io/klovi artifact
  |
  +-- starts bundled server entry via startKloviServer()
  |
  +-- composes HTTP routing:
  |     /api/*  --> server API handlers
  |     /*      --> bundled web assets (SPA fallback to index.html)
  |
  +-- opens browser to http://127.0.0.1:<port>
  |
  Browser loads bundled UI assets
    |
    +-- mountKloviApp() with:
          client:     HTTP-backed KloviClient (POST /api/rpc/:method)
          hostBridge: browser KloviHostBridge (desktop capabilities gated off)
```

The source tree remains split across `apps/package`, `packages/server`, and `packages/ui`, but the npm distribution bundles internal workspace code into a self-contained publish artifact.

### Desktop Mode

```
User launches Klovi.app / klovi.exe / Klovi.AppImage

Electrobun (apps/desktop)
  |
  +-- imports packages/server service functions directly (no HTTP server)
  |
  +-- loads packages/ui in Electrobun webview
  |
  +-- mountKloviApp() with:
        client:     Electrobun-RPC-backed KloviClient (IPC via Electrobun typed RPC)
        hostBridge: Electrobun-backed KloviHostBridge (full native capabilities)
```

### What Each Distribution App Owns

**`apps/package`** owns:
- The CLI entrypoint (`klovi` bin)
- The public npm package identity: `@cookielab.io/klovi`
- The public programmatic export: `@cookielab.io/klovi/server`
- HTTP routing composition: `/api/*` routes to server, `/*` serves web assets
- SPA fallback to `index.html` for client-side routing
- Browser launch after server start
- Staging a sanitized publish artifact that bundles internal workspace code for npm consumers

**`apps/desktop`** owns:
- Electrobun window creation, menu integration, updater lifecycle
- Native host bridge implementation (directory browse, updates, menu actions, open external)
- Electrobun webview loading of `packages/ui`
- Direct invocation of server service functions (no embedded HTTP server)
- Desktop-specific release artifacts

Neither `packages/server` nor `packages/ui` knows how it is being composed or served.

## Public npm Contract

### Public

- `@cookielab.io/klovi`
- `klovi` CLI entrypoint
- `@cookielab.io/klovi/server`
- `startKloviServer(options)`

### Internal-only implementation modules

- `packages/server`
- `packages/ui`
- `packages/plugin-*`
- `packages/design-system`
- `packages/ui-components`

These internal workspace packages remain the monorepo implementation boundary, not a public npm distribution surface.

## Key Contracts

### `mountKloviApp(config)` — packages/ui

Single entry point for mounting the shared React application. Both distribution modes call this with runtime-specific wiring.

Config shape:
- `container: HTMLElement` — DOM element to render into
- `client: KloviClient` — server-backed operations
- `hostBridge: KloviHostBridge` — native capabilities (real or stub)

Source: `packages/ui/src/bootstrap.tsx`

### `KloviClient` — packages/ui

Transport-neutral interface for all server-backed data operations: projects, sessions, stats, search, plugin settings, general settings, version info.

The browser implementation uses HTTP (`POST /api/rpc/:method`) to talk to the server. The desktop implementation uses Electrobun typed RPC to call server service functions directly in the main process (no HTTP server).

Source: `packages/ui/src/lib/client.ts`

### `KloviHostBridge` — packages/ui

Interface for desktop-native capabilities. The browser implementation stubs out unsupported operations. The desktop implementation delegates to Electrobun RPC.

Source: `packages/ui/src/lib/host-bridge.ts`

### `KloviHostCapabilities` — packages/ui

Feature flags checked by the shared UI to gate desktop-only features (`desktop`, `browseDirectory`, `updater`, `menuActions`). The UI branches on these flags instead of checking runtime globals.

Source: `packages/ui/src/lib/host-bridge.ts`

### `startKloviServer(options)` — packages/server, re-exported publicly via `@cookielab.io/klovi/server`

Starts the backend API server. Returns `{ url, stop() }`. Both distribution apps call this to start the server, and the npm package preserves it as a public embedding contract.

Key options:
- `host`, `port` — binding address
- `version` — version string passed to the server
- `commit` — commit string passed to the server
- `runtime` — `"auto" | "bun" | "node"`

Source: `packages/server/src/server.ts`

### `POST /api/rpc/:method` — packages/server

HTTP transport for server-backed operations. JSON request/response. One route per method. No desktop-native functionality is exposed here. Requests dispatch directly through the Effect layer to `KloviServices` — there is no intermediate `rpc.ts` dispatch table.

The HTTP routing that maps `/api/*` to these handlers lives in the distribution app (`apps/package` or `apps/desktop`), not in `packages/server` itself.

## Dual Runtime Support

The server runs on both Bun and Node through `@effect/platform`:

- Shared server logic uses Effect services (`FileSystem`, `Path`, `HttpServer`) — no Bun or Node globals.
- Bun adapter: `@effect/platform-bun` — used when invoked via `bunx` or from Electrobun.
- Node adapter: `@effect/platform-node` — used when invoked via `npx`.
- Runtime is auto-detected (`typeof globalThis.Bun !== "undefined"`) or explicitly selected.

Source: `packages/server/src/effect/platform-bun.ts`, `packages/server/src/effect/platform-node.ts`

## Current State

The core Arch2 source architecture is implemented. The single-package npm publish path is fully wired and verified.

- `packages/server` (`@cookielab.io/klovi-server`) exists as a pure internal backend with Effect-based services, dual runtime adapters (Bun + Node via `@effect/platform`), and `startKloviServer()`. It has no static file serving or CLI responsibilities in source.
- `packages/ui` exists as the shared React application with `mountKloviApp()`, `KloviClient`, `KloviHostBridge`, and capability gating.
- `apps/package` exists as the composition layer for the browser-served variant and as the npm package source for `@cookielab.io/klovi`.
- `apps/desktop` exists as the Electrobun shell with native host bridge and embedded server startup.
- RPC dispatches directly through the Effect layer to `KloviServices` (no legacy `rpc.ts` dispatch table).
- Plugin registry refreshes correctly after settings changes without requiring restart.
- All plugins (Claude Code, Codex, OpenCode) run under both Bun and Node runtimes.
- Desktop build and release flows exist. The release workflow triggers npm publishing automatically with the same version.
- `@cookielab.io/klovi` is a self-contained staged npm artifact that bundles internal workspace dependencies.
- The staged artifact has a sanitized manifest (no `workspace:*` dependencies, no internal package references).
- Packed-artifact end-to-end verification proves `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` under both Node and Bun.
- `@cookielab.io/klovi/server` exposes `startKloviServer(options)` as the canonical public programmatic export.
- The npm publish workflow runs verification gates before publishing and only publishes from the staged artifact directory.
- Version and commit metadata are stamped into the staged artifact and surfaced at runtime.
- Publishing from `apps/package` source is blocked by a guardrail; only `apps/package/.stage/npm` is valid for publishing.

## Completed Work

- Plans 01-12: Core Arch2 source architecture
- Plans 13-19: Follow-up remediation (plugin Effect migration, dual-runtime support)
- Plans 20-23: Package restructuring (separate `apps/package` from `packages/server`)
- Plans 31-34: Publish remediation (self-contained artifact, sanitized manifest, packed-artifact verification, npm publish workflow)
- Plans 35-38: Follow-up alignment (public server export, artifact metadata, release-to-publish wiring, documentation)

## Constraints

- No caching of any kind (no in-memory, file-based, HTTP, memoization, or TTL caches).
- No new packages under `packages/`.
- Electrobun stays as the desktop runtime.
- Bun is the primary toolchain for building, testing, and linting.
- Existing `packages/*` must not be collapsed into app-local code.
- Browser mode defaults to localhost-only (`127.0.0.1`).
- Only `@cookielab.io/klovi` is published to npm; internal workspace packages are bundled, not published.
- After every change: `bun run check`, `bun run typecheck`, `bun test`.
