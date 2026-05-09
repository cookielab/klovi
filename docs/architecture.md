# Architecture

## Overview

Klovi has two distribution modes that share the same backend and UI packages:

- `apps/desktop` for the native Electrobun app
- `apps/package` for the browser-served npm package

The shared source-of-truth packages are:

- `packages/server` for backend services and HTTP server startup
- `packages/ui` for the shared React app shell and transport-neutral contracts,
  including the desktop host contract in `src/shared/desktop-contract.ts`
- `packages/plugin-*`, `packages/ui-components`, and `packages/design-system`
  for plugins and reusable UI

Built-in plugins currently cover:

- Claude Code
- Codex CLI
- Cursor
- OpenCode

## Workspace Structure

```text
Klovi/
├── apps/
│   ├── desktop/
│   │   ├── src/bun/index.ts
│   │   ├── src/shared/rpc-types.ts
│   │   └── src/views/main/index.ts
│   └── package/
│       ├── src/cli.ts
│       ├── src/server.ts
│       ├── src/http-app.ts
│       └── scripts/stage-npm.ts
├── packages/
│   ├── server/
│   │   ├── src/server.ts
│   │   ├── src/effect/
│   │   └── src/services/
│   ├── ui/
│   │   ├── src/bootstrap.tsx
│   │   ├── src/main.tsx
│   │   ├── src/app/
│   │   └── src/lib/
│   ├── plugin-core/
│   ├── plugin-claude-code/
│   ├── plugin-codex/
│   ├── plugin-cursor/
│   ├── plugin-opencode/
│   ├── ui-components/
│   └── design-system/
└── scripts/
    └── verify-packed-artifact.ts
```

## Runtime Composition

### Browser/npm mode

`apps/package` owns the distribution-specific wiring:

- `src/cli.ts` resolves CLI config and starts the package server
- `src/server.ts` re-exports `startKloviServer` publicly and keeps
  `startKloviPackageServer` internal for package composition
- `src/http-app.ts` composes the RPC router from `packages/server` with static
  asset serving from `packages/ui/dist`
- `scripts/stage-npm.ts` produces the sanitized staged artifact in
  `apps/package/.stage/npm`

At runtime:

1. The user runs `bunx @cookielab.io/klovi` or `npx @cookielab.io/klovi`
2. `startKloviPackageServer(...)` starts the backend and serves the UI bundle
3. The browser loads `packages/ui` assets and talks to `/api/rpc/:method`

### Desktop mode

`apps/desktop` owns the native shell:

- `src/bun/index.ts` starts the Electrobun app, menu, updater, and main-process
  RPC handlers
- `src/views/main/index.ts` mounts the shared UI from `@cookielab.io/klovi-ui`
- `src/shared/rpc-types.ts` adapts the shared desktop contract to Electrobun's
  typed RPC schema

At runtime:

1. Electrobun starts the desktop shell
2. The main process calls `packages/server` services directly
3. The webview mounts `mountKloviApp(...)` from `packages/ui`
4. The shared UI talks to the main process through Electrobun RPC instead of HTTP

## Shared Contracts

### `mountKloviApp(config)` in `packages/ui`

`packages/ui/src/bootstrap.tsx` exposes the single mount entrypoint for both
distribution modes.

Config:

- `container: HTMLElement`
- `client: KloviClient`
- `hostBridge: KloviHostBridge`

### `KloviClient`

Defined in `packages/ui/src/lib/client.ts`.

This is the transport-neutral interface for server-backed operations:

- onboarding and version info
- projects, sessions, and search
- plugin/general settings

Browser mode implements it over HTTP. Desktop mode implements it over Electrobun
RPC today, and the same request map can be reused by a future Electron IPC layer.

### `KloviHostBridge`

Defined in `packages/ui/src/lib/host-bridge.ts`.

This carries desktop-native capabilities such as:

- directory browsing
- updater lifecycle
- menu actions
- open external links

Browser mode uses the stubbed `browserHostBridge`. Desktop mode wires the real
Electrobun-backed implementation. The request/message surface lives in
`packages/ui/src/shared/desktop-contract.ts`, so the transport adapter can be
swapped without changing the shared UI contract.

### `startKloviServer(options)`

Defined in `packages/server/src/server.ts` and re-exported publicly by
`@cookielab.io/klovi/server`.

This starts the backend API server and returns:

```ts
type KloviServer = {
  url: string;
  stop(): void;
};
```

`apps/package` uses it as the public programmatic API. Internally it builds on
shared bootstrap logic in `packages/server/src/effect/bootstrap.ts`.

## Backend and Plugin Flow

`packages/server` is the internal backend boundary. It owns:

- Effect-based server bootstrap and runtime selection
- HTTP RPC routing in `src/effect/http-app.ts`
- service composition in `src/effect/server-services.ts`
- registry creation and settings-backed refresh in `src/services/**`
- built-in plugin catalog and auto-discovery based on configured data directories

Plugins remain separate packages:

- `packages/plugin-claude-code`
- `packages/plugin-codex`
- `packages/plugin-cursor`
- `packages/plugin-opencode`

`packages/plugin-core` provides the registry and canonical plugin contracts.

Plugins are driver packages. They are responsible for reading provider-specific
local storage and converting it into Klovi's canonical project, session, turn,
and tool-call model. Plugin-specific data shapes should not leak into the UI
layer. In particular, plugin packages must not export React components, JSX,
CSS, DOM behavior, or UI class names, and reusable UI should not need to branch
on provider ids or raw provider tool names.

The stricter plugin boundary and the current remediation plan are documented in
[`docs/plugins.md`](plugins.md).

Settings are stored in JSON and include:

- per-plugin `enabled` state
- per-plugin `dataDir` overrides
- general security warning preference
- desktop update channel/check interval/auto-download preferences

## UI Layering

UI is split into two layers:

- `packages/ui` owns routing, onboarding, settings flow, host-bridge integration,
  shared app state, and wrapper components
- `packages/ui-components` owns reusable rendering for messages, sessions,
  presentation mode, search, tools, and utility components

Reusable UI renders the canonical model from `packages/plugin-core`. Provider
translation belongs in plugins or in narrowly scoped migration shims while the
tool-call model is being normalized.

`packages/design-system` provides the global styles, tokens, and reusable
primitives consumed by `packages/ui` and `packages/ui-components`.

## Verification Workflow

The repository baseline verification set is:

- `bun run lint`
- `bun run typecheck`
- `bun test`

Additional release/runtime verification:

- `bun run test:node-smoke`
- `bun run stage:npm`
- `bun run verify:packed-artifact`

The packed-artifact verifier proves that the staged npm package installs and
runs correctly under both Node and Bun.
