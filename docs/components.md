# Components

## Component Layers

Klovi UI is split into two layers:

1. **App shell (`src/frontend`)**
- Owns routing, RPC calls, onboarding/security flow, and settings
- Wraps reusable package components with app-specific behavior

2. **Reusable UI package (`packages/klovi-ui`)**
- Owns message/session/presentation/search/tool rendering components
- Exported as `@cookielab.io/klovi-ui/*`

This keeps desktop-app wiring in one place while making UI modules reusable and easier to test.

## App Shell Components (`src/frontend/components`)

### App and Gate

- `AppGate` (`src/frontend/App.tsx`) handles first-launch onboarding and startup security warning
- `App` (`src/frontend/App.tsx`) handles view rendering, search modal, menu event listeners, and presentation overrides

### Layout

- `layout/Layout.tsx`: app frame (sidebar + main content)
- `layout/Sidebar.tsx`: logo/version/search button/footer, fetches version via RPC
- `layout/Header.tsx`: title, breadcrumb, session badge, resume command copy, presentation toggle

### Settings and Startup UX

- `settings/SettingsView.tsx`: General + Plugins settings, reset-to-defaults flow
- `settings/SettingsSidebar.tsx`: settings tab navigation
- `settings/PluginRow.tsx`: plugin enable/path controls
- `ui/Onboarding.tsx`: first-launch 2-step flow (security notice + plugin setup)
- `ui/SecurityWarning.tsx`: recurring startup warning/accept flow

### Package Wrapper Components

These bind `@cookielab.io/klovi-ui` components to Klovi RPC and app-specific handlers.

| Wrapper | Uses | Responsibility |
|---|---|---|
| `dashboard/PackageDashboardStats.tsx` | `@cookielab.io/klovi-ui/sessions` `DashboardStats` | Fetches `getStats` and passes loading/error/retry state |
| `project/PackageProjectList.tsx` | `ProjectList` | Fetches projects, controls filter + hide/show state wiring |
| `project/PackageSessionList.tsx` | `SessionList` | Fetches sessions and maps `pluginId` to display name |
| `project/PackageHiddenProjectList.tsx` | `HiddenProjectList` | Fetches projects and filters hidden entries |
| `session/SessionView.tsx` | `PackageMessageList` | Fetches session and renders message stream |
| `session/SessionPresentation.tsx` | `PackagePresentationShell` | Fetches session and renders presentation mode |
| `session/SubAgentPresentation.tsx` | `PackagePresentationShell` | Fetches sub-agent session for presentation |
| `session/PackagePresentationShell.tsx` | `PresentationShell` | Injects frontend plugin lookup + external link handler |
| `message/PackageMessageList.tsx` | `MessageList` | Injects frontend plugin lookup + external link handler |
| `message/PackageSubAgentView.tsx` | `SubAgentView` | Fetches sub-agent session and renders package component |
| `search/PackageSearchModal.tsx` | `SearchModal` | Converts selected result to app route params |

## Reusable UI Package (`packages/klovi-ui`)

### Messages (`@cookielab.io/klovi-ui/messages`)

- `MessageList`
- `UserMessage`
- `AssistantMessage`
- `ThinkingBlock`
- `SubAgentView`
- `MarkdownRenderer`
- `UserBashContent`

Responsibilities:
- Render typed turns (`Turn[]`)
- Handle plan/implementation links
- Render content blocks chronologically
- Support plugin-specific formatting via injected frontend plugin handlers

### Tools (`@cookielab.io/klovi-ui/tools`)

- `ToolCall`
- `SmartToolOutput`
- `DiffView`
- `BashToolContent`
- Helpers: `getToolSummary`, `formatToolInput`, `truncateOutput`, `hasInputFormatter`

Responsibilities:
- Collapsible tool-call rendering
- Smart summaries and plugin-specific input formatting
- Text/diff/image tool output rendering

### Sessions (`@cookielab.io/klovi-ui/sessions`)

- `DashboardStats`
- `ProjectList`
- `SessionList`
- `HiddenProjectList`
- Helper: `projectDisplayName`

Responsibilities:
- Session/project browsing UI
- Dashboard metrics cards
- List filtering and selection UX

### Presentation (`@cookielab.io/klovi-ui/presentation`)

- `PresentationShell`
- `usePresentationMode`
- `useKeyboard`

Responsibilities:
- Step-by-step reveal model for turns/content blocks
- Keyboard controls and fullscreen toggling

### Search (`@cookielab.io/klovi-ui/search`)

- `SearchModal`

Responsibilities:
- Query/filter against provided session list
- Keyboard navigation and selection

### Utilities (`@cookielab.io/klovi-ui/utilities`)

- `ErrorBoundary`
- `FetchError`
- `ImageLightbox`
- Format helpers (`formatRelativeTime`, `shortModel`, `detectOutputFormat`, ...)

## Frontend Plugin Integration

`src/frontend/plugin-registry.ts` registers frontend plugins from plugin packages:

- `@cookielab.io/klovi-plugin-claude-code/frontend`
- `@cookielab.io/klovi-plugin-codex/frontend`
- `@cookielab.io/klovi-plugin-opencode/frontend`

`PackageMessageList` and `PackagePresentationShell` pass `getFrontendPlugin` into `@cookielab.io/klovi-ui` so tool summaries/input formatters and resume command behavior can be plugin-specific.

## Design System

`@cookielab.io/klovi-design-system` provides shared primitives and globals:

- Components: buttons, badges, collapsible, modal, layout primitives, form controls
- Theme/font hooks
- Global tokens/reset/fonts loaded in `src/views/main/index.ts` via:

```ts
import "@cookielab.io/klovi-design-system/globals";
```

## Supporting Hooks

App-shell hooks used by wrappers and App:

- `hooks/useRpc.ts`: generic async RPC query with retry
- `hooks/useSessionData.ts`: session/sub-agent loaders
- `hooks/useViewState.ts`: hash route state machine
- `hooks/useTheme.ts`: global + presentation theme/font-size settings
- `hooks/useHiddenProjects.ts`: local hidden-project persistence
