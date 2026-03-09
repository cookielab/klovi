# Components

## UI Layers

Klovi's UI is split into two layers:

1. `packages/ui`
   Owns app state, routing, onboarding, settings, host-bridge integration, and
   wrapper components that bind the shared shell to runtime-specific behavior.
2. `packages/ui-components`
   Owns reusable rendering for messages, sessions, presentation mode, search,
   tools, and utility components.

This keeps distribution-specific behavior out of the reusable rendering layer.

## App Shell (`packages/ui/src/app`)

### Core entry points

- `App.tsx`
  Defines `App` and `AppGate`, including onboarding, security warning gating,
  settings flow, and the main view switch.
- `plugin-registry.ts`
  Registers frontend plugin integrations from the plugin packages.
- `view-state.ts`
  Resolves hash-based navigation for the shared UI shell.

### Hooks

- `hooks/useRpc.ts` for generic async client calls
- `hooks/useSessionData.ts` for session and sub-agent loading
- `hooks/useViewState.ts` for route restoration and navigation
- `hooks/useUpdateStatus.ts` for updater status subscription through the host bridge
- `hooks/useTheme.ts` and `hooks/useHiddenProjects.ts` for persisted UI state

### Wrapper components

These components connect `packages/ui-components` to `KloviClient`,
`KloviHostBridge`, and frontend plugins:

| Wrapper | Purpose |
|---|---|
| `components/dashboard/PackageDashboardStats.tsx` | Fetch dashboard stats and pass loading/error state |
| `components/project/PackageProjectList.tsx` | Fetch/filter projects and manage hide actions |
| `components/project/PackageSessionList.tsx` | Fetch sessions for a project and map plugin display names |
| `components/project/PackageHiddenProjectList.tsx` | Render hidden project management |
| `components/search/PackageSearchModal.tsx` | Map search results back into app routes |
| `components/message/PackageMessageList.tsx` | Inject frontend plugin lookup and external-link handling |
| `components/message/PackageSubAgentView.tsx` | Fetch and render sub-agent sessions |
| `components/session/PackagePresentationShell.tsx` | Inject plugin lookup and external-link handling for presentation mode |

The `Package*` prefix is intentional: these are app-shell wrappers around the
reusable UI package, not dead code.

## Reusable UI (`packages/ui-components`)

### Messages

`@cookielab.io/klovi-ui-components/messages`

- `MessageList`
- `UserMessage`
- `AssistantMessage`
- `ThinkingBlock`
- `SubAgentView`
- `MarkdownRenderer`
- `UserBashContent`

### Sessions

`@cookielab.io/klovi-ui-components/sessions`

- `DashboardStats`
- `ProjectList`
- `SessionList`
- `HiddenProjectList`

### Presentation

`@cookielab.io/klovi-ui-components/presentation`

- `PresentationShell`
- `usePresentationMode`
- `useKeyboard`

### Search

`@cookielab.io/klovi-ui-components/search`

- `SearchModal`

### Tools

`@cookielab.io/klovi-ui-components/tools`

- `ToolCall`
- `SmartToolOutput`
- `DiffView`
- `BashToolContent`

### Utilities

`@cookielab.io/klovi-ui-components/utilities`

- `ErrorBoundary`
- `FetchError`
- `ImageLightbox`
- formatting helpers such as `formatRelativeTime`, `shortModel`, and
  `detectOutputFormat`

## Frontend Plugin Integration

`packages/ui/src/app/plugin-registry.ts` registers frontend plugin integrations from:

- `@cookielab.io/klovi-plugin-claude-code/frontend`
- `@cookielab.io/klovi-plugin-codex/frontend`
- `@cookielab.io/klovi-plugin-opencode/frontend`

The app-shell wrappers inject `getFrontendPlugin(...)` into the reusable message
and presentation components so plugin-specific tool summaries, input formatting,
and resume commands stay centralized.

## Design System

`@cookielab.io/klovi-design-system` provides:

- global tokens, reset, and font loading
- layout and form primitives
- theme and font-size hooks

`packages/ui/src/styles.ts` is the shared side-effect entrypoint for loading the
design-system globals.

## Desktop vs Browser Wiring

`packages/ui` stays runtime-neutral through the `KloviClient` and
`KloviHostBridge` contracts:

- `apps/package` mounts the app with an HTTP client and `browserHostBridge`
- `apps/desktop` mounts the app with an Electrobun RPC client and desktop host bridge
