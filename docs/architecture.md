# Architecture

## Overview

Klovi is a native desktop app built with [Electrobun](https://electrobun.dev). It runs as a Bun main process plus a React webview, and uses typed RPC for all communication between them.

The repository is a Bun workspace monorepo:

- Plugin logic is split into workspace packages (`@cookielab.io/klovi-plugin-*`)
- Shared UI primitives live in `@cookielab.io/klovi-design-system`
- Reusable feature UI lives in `@cookielab.io/klovi-ui-components`
- The desktop app shell (routing, settings/onboarding flow, Electrobun main process) lives in `apps/desktop/src/`

There is no HTTP server.

## Workspace Structure

```text
Klovi/
├── package.json
├── bunfig.toml
├── biome.json
├── docs/
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── electrobun.config.ts
│       ├── packaging/
│       ├── src/
│       │   ├── bun/
│       │   │   ├── index.ts          # Electrobun app entry + menu + RPC handlers
│       │   │   ├── rpc-handlers.ts   # Main-process request handlers
│       │   │   └── settings.ts       # Settings load/save/defaults
│       │   ├── views/main/
│       │   │   ├── index.html
│       │   │   └── index.ts          # Electroview RPC + React mount
│       │   ├── frontend/
│       │   │   ├── App.tsx           # App + AppGate (onboarding/security gate)
│       │   │   ├── view-state.ts     # Hash route parsing + navigation helpers
│       │   │   ├── rpc.ts            # Frontend RPC client contract
│       │   │   ├── plugin-registry.ts
│       │   │   ├── components/
│       │   │   ├── hooks/
│       │   │   └── utils/
│       │   ├── plugins/
│       │   │   ├── catalog.ts        # Built-in plugin descriptor list + default dirs
│       │   │   ├── auto-discover.ts  # Creates registry based on availability + settings
│       │   │   └── registry.ts       # Typed wrapper over core PluginRegistry
│       │   ├── parser/
│       │   │   └── stats.ts          # Cross-project stats scan (messages/tokens/models)
│       │   └── shared/
│       │       ├── rpc-types.ts      # Typed Klovi RPC schema
│       │       ├── types.ts          # Shared app types
│       │       ├── session-id.ts     # Session ID codec
│       │       └── plugin-types.ts   # Shared ToolPlugin aliases
├── packages/
│   ├── klovi-plugin-core/            # Shared plugin contracts + PluginRegistry
│   ├── klovi-plugin-claude-code/     # Claude Code discovery + parsing + frontend plugin
│   ├── klovi-plugin-codex/           # Codex discovery + parsing + frontend plugin
│   ├── klovi-plugin-opencode/        # OpenCode discovery + parsing + frontend plugin
│   ├── klovi-design-system/          # Design tokens + UI primitives + global styles
│   └── klovi-ui-components/          # Reusable Klovi feature components
```

## Runtime Architecture

### Main Process (Bun)

`apps/desktop/src/bun/index.ts`:

1. Defines typed RPC with `BrowserView.defineRPC<KloviRPC>()`
2. Creates a `BrowserWindow` for `views://main/index.html`
3. Configures native `ApplicationMenu`
4. Forwards menu actions to webview RPC messages

Registry lifecycle:

- The plugin registry is created lazily only after `acceptRisks` is called
- Until then, data-reading endpoints are gated

### Webview (React)

`apps/desktop/src/views/main/index.ts`:

1. Creates Electroview RPC client
2. Registers message handlers (`cycleTheme`, `togglePresentation`, `openSettings`, ...)
3. Calls `setRPCClient(...)` for frontend code
4. Mounts `AppGate`

`AppGate` (`apps/desktop/src/frontend/App.tsx`) handles first-launch UX:

- `isFirstLaunch` decides onboarding vs regular flow
- `getGeneralSettings` decides whether to show startup security warning
- `acceptRisks` unlocks the registry and then renders the main app

## RPC Contract

Defined in [`apps/desktop/src/shared/rpc-types.ts`](../apps/desktop/src/shared/rpc-types.ts).

### Bun Requests

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
- `openExternal`
- `browseDirectory`

### Main → Webview Messages

- `cycleTheme`
- `increaseFontSize`
- `decreaseFontSize`
- `togglePresentation`
- `openSettings`

## Data Flow

```text
Tool data on disk
  ~/.claude/projects/**/*.jsonl
  ~/.codex/sessions/**/*.jsonl
  ~/.local/share/opencode/opencode.db
        │
        ▼
Plugin packages (@cookielab.io/klovi-plugin-*)
  - discover projects
  - list sessions
  - load sessions/sub-agents
  - provide frontend plugin formatters/summaries
        │
        ▼
Core registry (@cookielab.io/klovi-plugin-core)
  PluginRegistry merges projects by resolved path
  Session IDs are encoded as pluginId::rawSessionId
        │
        ▼
App registry wrapper (`apps/desktop/src/plugins/registry.ts`)
Auto-discovery + settings integration (`apps/desktop/src/plugins/auto-discover.ts`)
        │
        ▼
RPC handlers (`apps/desktop/src/bun/rpc-handlers.ts`)
        │
        ▼
React wrappers in `apps/desktop/src/frontend/components/*`
        │
        ▼
Reusable UI in @cookielab.io/klovi-ui-components
```

## Frontend Composition

The frontend is intentionally split into two layers:

1. **App shell layer (`apps/desktop/src/frontend`)**
- Routing/state (`useViewState`, hash navigation)
- RPC data fetching (`useRpc`, `useSessionData`)
- Electrobun integration (`openExternal`, menu events)
- App-specific flows (onboarding, security warning, settings)

2. **Reusable UI layer (`packages/klovi-ui-components`)**
- Messages (`@cookielab.io/klovi-ui-components/messages`)
- Session/project widgets (`@cookielab.io/klovi-ui-components/sessions`)
- Presentation shell (`@cookielab.io/klovi-ui-components/presentation`)
- Search modal (`@cookielab.io/klovi-ui-components/search`)
- Tool rendering (`@cookielab.io/klovi-ui-components/tools`)
- Utilities (`@cookielab.io/klovi-ui-components/utilities`)

The app layer uses `Package*` wrapper components to bind shared UI components to Klovi RPC and app-specific handlers.

## Routing

Hash routes are resolved in `apps/desktop/src/frontend/view-state.ts`:

- `#/` → home
- `#/hidden` → hidden projects
- `#/settings` → settings
- `#/:encodedPath` → project sessions list
- `#/:encodedPath/:sessionId` → session view/presentation
- `#/:encodedPath/:sessionId/subagent/:agentId` → sub-agent view/presentation

## Plugin System

### Core

`@cookielab.io/klovi-plugin-core` provides:

- `ToolPlugin` interface
- `PluginRegistry` implementation
- Built-in plugin IDs (`claude-code`, `codex-cli`, `opencode`)
- Session ID and path encoding helpers

### Built-in plugin catalog

`apps/desktop/src/plugins/catalog.ts` declares built-in plugins and default data directories.

`apps/desktop/src/plugins/auto-discover.ts`:

- Applies settings overrides for plugin directories
- Skips disabled plugins
- Registers only plugins with available data (`getDefaultDataDir` / `isDataAvailable`)

### Frontend plugin registry

`apps/desktop/src/frontend/plugin-registry.ts` registers package-provided frontend plugins:

- `@cookielab.io/klovi-plugin-claude-code/frontend`
- `@cookielab.io/klovi-plugin-codex/frontend`
- `@cookielab.io/klovi-plugin-opencode/frontend`

These provide plugin-specific summary extractors, input formatters, and resume command behavior consumed by `@cookielab.io/klovi-ui-components` components.

## Settings Model

Settings are stored in a local JSON file via `apps/desktop/src/bun/settings.ts`.

Schema highlights:

- Per-plugin settings: `enabled`, `dataDir`
- General settings: `showSecurityWarning`
- Versioned settings structure (`version: 1`)

Settings endpoints are handled in `apps/desktop/src/bun/rpc-handlers.ts`:

- `getPluginSettings`, `updatePluginSetting`
- `getGeneralSettings`, `updateGeneralSettings`
- `resetSettings`, `isFirstLaunch`

## Type Boundaries

- `apps/desktop/src/shared/types.ts` re-exports canonical app data shapes from `@cookielab.io/klovi-ui-components/types`
- `apps/desktop/src/shared/rpc-types.ts` defines the full typed RPC schema
- `apps/desktop/src/shared/session-id.ts` handles `pluginId::rawSessionId` encoding/decoding

This keeps plugin packages, app shell, and reusable UI aligned on the same contracts.

## Build and Dev

- `bun run dev` → root wrapper to `apps/desktop`
- `bun run build` → root wrapper to `apps/desktop`

Electrobun bundles both:

- Bun main process (`apps/desktop/src/bun/index.ts`)
- Webview entry (`apps/desktop/src/views/main/index.ts`)
