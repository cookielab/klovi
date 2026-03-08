# Arch2 Initiative

## Goal

Split Klovi into a three-app layout while preserving its existing package boundaries:

- `apps/server` becomes the published CLI and browser-served application backend
- `apps/web` becomes the source of truth for the shared application UI
- `apps/desktop` remains the Electrobun desktop shell

The user-facing reason for this initiative is to support both:

- a native desktop experience through Electrobun
- a browser-served variant runnable with `npx @cookielab.io/klovi@latest` or `bunx @cookielab.io/klovi@latest`

The two variants must share the same core UI and the same application behavior wherever the browser runtime makes that possible.

## Verified Current State

Klovi is currently a single desktop application. The Bun main process, desktop-only integrations, app services, and React shell all live under `apps/desktop`.

Current structure and responsibilities:

- `apps/desktop/src/bun/index.ts`
  Electrobun entrypoint, window creation, menu wiring, RPC registration, updater lifecycle.
- `apps/desktop/src/bun/rpc-handlers.ts`
  Request handlers for app data, settings, plugin configuration, and search/session loading.
- `apps/desktop/src/bun/settings.ts`
  Settings persistence and defaults.
- `apps/desktop/src/views/main/index.ts`
  Electroview entrypoint, frontend RPC bootstrap, React mount.
- `apps/desktop/src/frontend/App.tsx`
  `App` plus `AppGate`, including onboarding, security warning, update state listeners, and main app composition.
- `apps/desktop/src/plugins/*`
  Built-in plugin catalog, registry wrapper, and auto-discovery integration.
- `apps/desktop/src/parser/stats.ts`
  Cross-project stats aggregation.

The current architecture has these key properties:

- There is no HTTP server.
- The frontend talks to the Bun main process through Electrobun RPC only.
- Data access and native desktop concerns are mixed together in the desktop application.
- The package split under `packages/` is already meaningful and should be retained.

## Constraints

- Use Bun, not Node.js-centric tooling, for repo scripts and runtime decisions.
- After every implementation task, run:
  - `bun run check`
  - `bun run typecheck`
  - `bun test`
- Do not add caching of any kind.
- Electrobun must remain the desktop runtime.
- Existing `packages/*` must be preserved as separate packages.
- Do not add new packages under `packages/` as part of this initiative.
- The browser mode should default to localhost-only operation.

## Target Architecture

### Apps

#### `apps/server`

Responsibilities:

- publish as `@cookielab.io/klovi`
- expose the `klovi` CLI
- start the HTTP server
- expose `POST /api/rpc/:method`
- serve the built `apps/web` bundle
- export `startKloviServer(options)` for desktop embedding through `@cookielab.io/klovi/server`

#### `apps/web`

Responsibilities:

- own the canonical shared application shell
- export `mountKloviApp(config)`
- provide the browser entrypoint
- provide the transport-neutral client and host bridge contracts used by the shared app shell

#### `apps/desktop`

Responsibilities:

- remain the Electrobun shell
- own window creation, menu integration, updater behavior, and native dialogs
- expose only desktop-native behavior over Electrobun RPC
- embed the local server through `startKloviServer(options)`
- mount the shared app from `apps/web`

### Existing Package Roles That Must Stay Intact

#### `packages/klovi-plugin-core`

- plugin contracts
- plugin registry primitives
- canonical plugin-facing helpers

#### `packages/klovi-plugin-claude-code`

- Claude Code discovery and parsing
- Claude Code frontend plugin integration

#### `packages/klovi-plugin-codex`

- Codex discovery and parsing
- Codex frontend plugin integration

#### `packages/klovi-plugin-opencode`

- OpenCode discovery and parsing
- OpenCode frontend plugin integration

#### `packages/klovi-ui-components`

- reusable feature UI
- message/session/presentation/search/tool rendering

#### `packages/klovi-design-system`

- design tokens
- UI primitives
- global styles and theme hooks

No part of this initiative should collapse those responsibilities into app-local copies.

## Runtime Model

### Browser Mode

- The user runs `npx @cookielab.io/klovi@latest` or `bunx @cookielab.io/klovi@latest`.
- `apps/server` starts on `127.0.0.1` by default.
- The server exposes `POST /api/rpc/:method`.
- The server serves the built `apps/web` bundle.
- `apps/web/src/main.tsx` mounts the shared app with an HTTP-backed `KloviClient` and a browser `KloviHostBridge`.
- Desktop-only capabilities are disabled by capability gating.

### Desktop Mode

- Electrobun starts the desktop shell.
- The desktop shell starts the embedded server through `startKloviServer(options)`.
- The desktop shell mounts the shared app by importing `mountKloviApp(config)` from `apps/web`.
- The shared app receives a transport-neutral `KloviClient` that points at the embedded server.
- The shared app receives a desktop `KloviHostBridge` backed by Electrobun RPC.

### Shared UI Mount Contract

The shared app entry must live in `apps/web` and be named:

- `mountKloviApp(config)`

That function is the single source of truth for mounting the application shell in both browser mode and desktop mode.

## API And Interface Contracts

These names are locked for the initiative and should be used consistently in implementation and follow-up docs.

### `mountKloviApp(config)` in `apps/web`

Purpose:

- mount the shared React application
- accept runtime-specific wiring from browser mode or desktop mode

Required config shape:

- `container: HTMLElement`
- `client: KloviClient`
- `hostBridge: KloviHostBridge`
- `initialUrl?: string`

### `KloviClient`

Purpose:

- provide the shared app shell with transport-neutral request methods

It represents the server-backed methods only:

- `acceptRisks`
- `isFirstLaunch`
- `getVersion`
- `getStats`
- `getProjects`
- `getSessions`
- `getSession`
- `getSubAgent`
- `searchSessions`
- `getPluginSettings`
- `updatePluginSetting`
- `getGeneralSettings`
- `updateGeneralSettings`
- `resetSettings`

The browser implementation of `KloviClient` talks to `POST /api/rpc/:method`.

### `KloviHostBridge`

Purpose:

- provide desktop-native behavior that the shared app may optionally use

Methods and subscriptions:

- `getCapabilities(): KloviHostCapabilities`
- `browseDirectory(...)`
- `getUpdateSettings()`
- `updateUpdateSettings(...)`
- `checkForUpdate()`
- `applyUpdate()`
- `openExternal(...)`
- `onMenuAction(...)`
- `onUpdateStatus(...)`
- `onManualUpdateResult(...)`

Browser mode provides a browser implementation with capability flags turned off for unsupported features.

### `KloviHostCapabilities`

Required flags:

- `desktop`
- `browseDirectory`
- `updater`
- `menuActions`

The shared UI must branch on these flags rather than checking runtime globals directly.

### `POST /api/rpc/:method`

Purpose:

- stable transport boundary for the browser-served app

Rules:

- JSON request body
- JSON response body
- one route per method name
- no desktop-native functionality is exposed here

### `startKloviServer(options)`

Purpose:

- start the Klovi server from the CLI or from desktop mode

Export location:

- `@cookielab.io/klovi/server`

Minimum option shape:

- `host`
- `port`
- `mode`
- `staticDir`
- `openBrowser`

### `klovi`

Purpose:

- CLI entrypoint exposed by `@cookielab.io/klovi`

Minimum behavior:

- start localhost-only by default
- print the final URL
- serve the shared web app and the HTTP RPC backend

## Migration Strategy

1. Create `apps/web` and define `mountKloviApp(config)` as the canonical app entry.
2. Move the shared app shell from desktop into `apps/web`.
3. Replace direct Electrobun frontend assumptions with `KloviClient` and `KloviHostBridge`.
4. Move server-appropriate application logic from desktop into `apps/server`.
5. Expose that logic over `POST /api/rpc/:method`.
6. Serve the built `apps/web` bundle from `apps/server`.
7. Make `apps/server` the published `@cookielab.io/klovi` package.
8. Reduce desktop RPC to native-only capabilities.
9. Start the embedded server from Electrobun and point the shared app at it.
10. Add browser capability gating for desktop-only features.
11. Add root and app-level dev/build/test workflows for the three-app layout.
12. Expand tests and smoke coverage for browser mode, desktop mode, and publishable server behavior.

The task documents under `docs/arch2/plans/` follow this exact sequence.

## Non-Goals

- No new caching layers, memoized result stores, or TTL-based caches.
- No replacement of Electrobun.
- No package consolidation under `packages/`.
- No new `packages/*` package introduced solely to support this split.
- No attempt to recreate every native desktop affordance in browser mode.

## Acceptance Criteria

The initiative is complete only when all of the following are true:

- `apps/server` exists and is the published `@cookielab.io/klovi` package.
- `apps/web` exists and owns `mountKloviApp(config)`.
- `apps/desktop` mounts the shared app from `apps/web` and remains Electrobun-based.
- `bunx @cookielab.io/klovi@latest` starts a localhost-only webserver by default.
- Browser mode serves the same core UI as desktop mode.
- Desktop still launches through Electrobun and renders the shared UI.
- Existing plugin packages continue to provide discovery and parsing unchanged.
- Existing UI packages continue to be reused instead of being copied into app-local code.
- Updates UI is unavailable in browser mode.
- Directory browse actions are unavailable in browser mode.
- Each implementation task is validated with:
  - `bun run check`
  - `bun run typecheck`
  - `bun test`

## Risk Notes

### Publish and package rename risk

The npm package name `@cookielab.io/klovi` currently belongs to the desktop package metadata. Reassigning that name to `apps/server` requires careful package metadata, build output, and release workflow changes.

### Desktop and server parity risk

Moving request handlers into `apps/server` creates a risk that desktop and browser mode diverge. The mitigation is to make both call the same `startKloviServer(options)` path and the same `KloviClient` method surface.

### UI capability divergence risk

Browser mode cannot support all desktop-native affordances. The mitigation is to centralize support checks in `KloviHostCapabilities` and to require UI gating rather than ad hoc runtime branching.
