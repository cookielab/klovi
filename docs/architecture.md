# Architecture

## Overview

Klovi is a native desktop app built with [Electrobun](https://electrobun.dev). It runs as a Bun main process plus a React webview, and uses typed RPC for all communication between them.

The repository is a Bun workspace monorepo:

- Plugin logic is split into workspace packages (`@cookielab.io/klovi-plugin-*`)
- Shared UI primitives live in `@cookielab.io/klovi-design-system`
- Reusable feature UI lives in `@cookielab.io/klovi-ui`
- The desktop app shell (routing, settings/onboarding flow, Electrobun main process) lives in `src/`

There is no HTTP server.

## Workspace Structure

```text
Klovi/
├── package.json
├── bunfig.toml
├── biome.json
├── electrobun.config.ts
├── docs/
├── packages/
│   ├── klovi-plugin-core/            # Shared plugin contracts + PluginRegistry
│   ├── klovi-plugin-claude-code/     # Claude Code discovery + parsing + frontend plugin
│   ├── klovi-plugin-codex/           # Codex discovery + parsing + frontend plugin
│   ├── klovi-plugin-opencode/        # OpenCode discovery + parsing + frontend plugin
│   ├── klovi-design-system/          # Design tokens + UI primitives + global styles
│   └── klovi-ui/                     # Reusable Klovi feature components
└── src/
    ├── bun/
    │   ├── index.ts                  # Electrobun app entry + menu + RPC handlers
    │   ├── rpc-handlers.ts           # Main-process request handlers
    │   └── settings.ts               # Settings load/save/defaults
    ├── views/main/
    │   ├── index.html
    │   └── index.ts                  # Electroview RPC + React mount
    ├── frontend/
    │   ├── App.tsx                   # App + AppGate (onboarding/security gate)
    │   ├── view-state.ts             # Hash route parsing + navigation helpers
    │   ├── rpc.ts                    # Frontend RPC client contract
    │   ├── plugin-registry.ts        # Frontend plugin lookup/registration
    │   ├── components/
    │   │   ├── dashboard/            # Wrapper components around @cookielab.io/klovi-ui
    │   │   ├── message/
    │   │   ├── project/
    │   │   ├── search/
    │   │   ├── session/
    │   │   ├── settings/             # App-specific settings screens
    │   │   ├── layout/               # App shell components
    │   │   └── ui/                   # App-specific onboarding/security components
    │   ├── hooks/                    # useRpc/useSessionData/useTheme/... 
    │   └── utils/
    ├── plugins/
    │   ├── catalog.ts                # Built-in plugin descriptor list + default dirs
    │   ├── auto-discover.ts          # Creates registry based on availability + settings
    │   └── registry.ts               # Typed wrapper over core PluginRegistry
    ├── parser/
    │   └── stats.ts                  # Cross-project stats scan (messages/tokens/models)
    └── shared/
        ├── rpc-types.ts              # Typed Klovi RPC schema
        ├── types.ts                  # Shared app types (re-exported from @cookielab.io/klovi-ui/types)
        ├── session-id.ts             # Session ID codec (pluginId::rawSessionId)
        └── plugin-types.ts           # Shared ToolPlugin aliases
```

## Runtime Architecture

### Main Process (Bun)

`src/bun/index.ts`:

1. Defines typed RPC with `BrowserView.defineRPC<KloviRPC>()`
2. Creates a `BrowserWindow` for `views://main/index.html`
3. Configures native `ApplicationMenu`
4. Forwards menu actions to webview RPC messages

Registry lifecycle:

- The plugin registry is created lazily only after `acceptRisks` is called
- Until then, data-reading endpoints are gated

### Webview (React)

`src/views/main/index.ts`:

1. Creates Electroview RPC client
2. Registers message handlers (`cycleTheme`, `togglePresentation`, `openSettings`, ...)
3. Calls `setRPCClient(...)` for frontend code
4. Mounts `AppGate`

`AppGate` (`src/frontend/App.tsx`) handles first-launch UX:

- `isFirstLaunch` decides onboarding vs regular flow
- `getGeneralSettings` decides whether to show startup security warning
- `acceptRisks` unlocks the registry and then renders the main app

## RPC Contract

Defined in [`src/shared/rpc-types.ts`](../src/shared/rpc-types.ts).

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
App registry wrapper (src/plugins/registry.ts)
Auto-discovery + settings integration (src/plugins/auto-discover.ts)
        │
        ▼
RPC handlers (src/bun/rpc-handlers.ts)
        │
        ▼
React wrappers in src/frontend/components/*
        │
        ▼
Reusable UI in @cookielab.io/klovi-ui
```

## Frontend Composition

The frontend is intentionally split into two layers:

1. **App shell layer (`src/frontend`)**
- Routing/state (`useViewState`, hash navigation)
- RPC data fetching (`useRpc`, `useSessionData`)
- Electrobun integration (`openExternal`, menu events)
- App-specific flows (onboarding, security warning, settings)

2. **Reusable UI layer (`packages/klovi-ui`)**
- Messages (`@cookielab.io/klovi-ui/messages`)
- Session/project widgets (`@cookielab.io/klovi-ui/sessions`)
- Presentation shell (`@cookielab.io/klovi-ui/presentation`)
- Search modal (`@cookielab.io/klovi-ui/search`)
- Tool rendering (`@cookielab.io/klovi-ui/tools`)
- Utilities (`@cookielab.io/klovi-ui/utilities`)

The app layer uses `Package*` wrapper components to bind shared UI components to Klovi RPC and app-specific handlers.

## Routing

Hash routes are resolved in `src/frontend/view-state.ts`:

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

`src/plugins/catalog.ts` declares built-in plugins and default data directories.

`src/plugins/auto-discover.ts`:

- Applies settings overrides for plugin directories
- Skips disabled plugins
- Registers only plugins with available data (`getDefaultDataDir` / `isDataAvailable`)

### Frontend plugin registry

`src/frontend/plugin-registry.ts` registers package-provided frontend plugins:

- `@cookielab.io/klovi-plugin-claude-code/frontend`
- `@cookielab.io/klovi-plugin-codex/frontend`
- `@cookielab.io/klovi-plugin-opencode/frontend`

These provide plugin-specific summary extractors, input formatters, and resume command behavior consumed by `@cookielab.io/klovi-ui` components.

## Settings Model

Settings are stored in a local JSON file via `src/bun/settings.ts`.

Schema highlights:

- Per-plugin settings: `enabled`, `dataDir`
- General settings: `showSecurityWarning`
- Versioned settings structure (`version: 1`)

Settings endpoints are handled in `src/bun/rpc-handlers.ts`:

- `getPluginSettings`, `updatePluginSetting`
- `getGeneralSettings`, `updateGeneralSettings`
- `resetSettings`, `isFirstLaunch`

## Type Boundaries

- `src/shared/types.ts` re-exports canonical app data shapes from `@cookielab.io/klovi-ui/types`
- `src/shared/rpc-types.ts` defines the full typed RPC schema
- `src/shared/session-id.ts` handles `pluginId::rawSessionId` encoding/decoding

This keeps plugin packages, app shell, and reusable UI aligned on the same contracts.

## Build and Dev

- `bun run dev` → `electrobun dev`
- `bun run build` → `electrobun build`

Electrobun bundles both:

- Bun main process (`src/bun/index.ts`)
- Webview entry (`src/views/main/index.ts`)
