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
  +-- starts packages/server via startKloviServer() in embedded mode
  |
  +-- loads packages/ui in Electrobun webview
  |
  +-- mountKloviApp() with:
        client:     HTTP-backed KloviClient (POST /api/rpc/:method against local server)
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
- Embedded server startup
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

The browser and desktop implementations both use HTTP (`POST /api/rpc/:method`) to talk to the server started by their respective distribution app.

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

The core Arch2 source architecture is implemented, but single-package npm publish remediation is still open.

- `packages/server` (`@cookielab.io/klovi-server`) exists as a pure internal backend with Effect-based services, dual runtime adapters (Bun + Node via `@effect/platform`), and `startKloviServer()`. It has no static file serving or CLI responsibilities in source.
- `packages/ui` exists as the shared React application with `mountKloviApp()`, `KloviClient`, `KloviHostBridge`, and capability gating.
- `apps/package` exists as the composition layer for the browser-served variant and as the intended npm package source for `@cookielab.io/klovi`.
- `apps/desktop` exists as the Electrobun shell with native host bridge and embedded server startup.
- RPC dispatches directly through the Effect layer to `KloviServices` (no legacy `rpc.ts` dispatch table).
- Plugin registry refreshes correctly after settings changes without requiring restart.
- All plugins (Claude Code, Codex, OpenCode) run under both Bun and Node runtimes.
- Desktop build and release flows exist separately from npm distribution.

### Not yet complete

- `@cookielab.io/klovi` is not yet documented or verified as a self-contained staged npm artifact that bundles internal workspace dependencies.
- The publish path does not yet have a finalized sanitized manifest generation flow for npm consumers.
- Packed-artifact end-to-end verification for `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` is not yet established as the source of truth.
- The release workflow does not yet define the single-package npm publish path described by this vision.

## Remaining Work

- [plans/31-make-apps-package-self-contained-for-npm.md](./plans/31-make-apps-package-self-contained-for-npm.md)
- [plans/32-generate-a-sanitized-publish-artifact.md](./plans/32-generate-a-sanitized-publish-artifact.md)
- [plans/33-verify-packed-artifact-under-node-and-bun.md](./plans/33-verify-packed-artifact-under-node-and-bun.md)
- [plans/34-restore-single-package-npm-publish-workflow.md](./plans/34-restore-single-package-npm-publish-workflow.md)

## Constraints

- No caching of any kind (no in-memory, file-based, HTTP, memoization, or TTL caches).
- No new packages under `packages/`.
- Electrobun stays as the desktop runtime.
- Bun is the primary toolchain for building, testing, and linting.
- Existing `packages/*` must not be collapsed into app-local code.
- Browser mode defaults to localhost-only (`127.0.0.1`).
- Only `@cookielab.io/klovi` is published to npm; internal workspace packages are bundled, not published.
- After every change: `bun run check`, `bun run typecheck`, `bun test`.
