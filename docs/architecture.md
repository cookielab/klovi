# Architecture

## Project Structure

```
Klovi/
├── package.json                        # Bun workspace root (@cookielab.io/klovi)
├── tsconfig.json                       # Strict TS config used across workspace
├── bunfig.toml                         # Bun config
├── biome.json                          # Lint + format config
├── electrobun.config.ts                # Desktop app build config
├── docs/architecture.md
├── packages/
│   ├── klovi-plugin-core/              # @cookielab.io/klovi-plugin-core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── ids.ts                  # Canonical plugin IDs + package names
│   │       ├── plugin-types.ts         # Unified ToolPlugin interfaces
│   │       ├── plugin-registry.ts      # Shared PluginRegistry implementation
│   │       ├── session-id.ts           # Session ID codec (pluginId::rawId)
│   │       ├── session-types.ts        # Shared session/turn model contracts
│   │       ├── iso-time.ts             # ISO sort helpers
│   │       ├── plugin-registry.test.ts # Core registry tests (edge cases)
│   │       ├── ids.test.ts             # Plugin ID/package-name tests
│   │       └── session-id.test.ts      # Session ID codec tests
│   ├── klovi-plugin-claude-code/       # @cookielab.io/klovi-plugin-claude-code
│   │   └── src/
│   │       ├── index.ts                # Claude Code ToolPlugin + public exports
│   │       ├── discovery.ts            # Project/session discovery from ~/.claude/projects/
│   │       ├── parser.ts               # JSONL session parser + sub-agent parsing
│   │       ├── config.ts               # Data-dir configuration
│   │       └── *.test.ts               # Plugin-specific tests
│   ├── klovi-plugin-codex/             # @cookielab.io/klovi-plugin-codex
│   │   └── src/
│   │       ├── index.ts                # Codex ToolPlugin + public exports
│   │       ├── discovery.ts            # Project/session discovery from ~/.codex/sessions/
│   │       ├── parser.ts               # JSONL event parser
│   │       ├── session-index.ts        # Session index scanner
│   │       ├── extractors.ts           # Tool summary extractors/input formatters
│   │       ├── config.ts               # Data-dir configuration
│   │       └── *.test.ts               # Plugin-specific tests
│   └── klovi-plugin-opencode/          # @cookielab.io/klovi-plugin-opencode
│       └── src/
│           ├── index.ts                # OpenCode ToolPlugin + public exports
│           ├── discovery.ts            # Project/session discovery from SQLite DB
│           ├── parser.ts               # SQLite message/part parser
│           ├── db.ts                   # SQLite database access
│           ├── extractors.ts           # Tool summary extractors/input formatters
│           ├── config.ts               # Data-dir configuration
│           └── *.test.ts               # Plugin-specific tests
│
└── src/
    ├── bun/                            # Main process (Bun runtime, runs in Electrobun)
    │   ├── index.ts                    # App entry: BrowserWindow, RPC definition, ApplicationMenu
    │   ├── rpc-handlers.ts             # RPC handler implementations (getProjects, getSession, etc.)
    │   └── rpc-handlers.test.ts        # RPC handler tests
    │
    ├── views/
    │   └── main/
    │       ├── index.html              # HTML template for the webview
    │       └── index.ts                # Webview entry: Electroview RPC, React mount, menu actions
    │
    ├── shared/
    │   ├── types.ts                    # Shared type definitions (Turn, Session, Project, etc.)
    │   ├── plugin-types.ts             # App-local aliases that re-export core plugin interfaces
    │   ├── rpc-types.ts                # KloviRPC schema (bun requests + webview messages)
    │   ├── content-blocks.ts           # ContentBlock grouping for presentation steps
    │   ├── session-id.ts               # Encode/decode pluginId:rawSessionId
    │   └── iso-time.ts                 # ISO timestamp sorting utilities
    │
    ├── parser/
    │   ├── session.test.ts             # buildTurns(), contentBlocks ordering, plan/impl linking
    │   ├── command-message.ts          # Slash command XML extraction
    │   ├── command-message.test.ts     # Command message tests
    │   ├── claude-dir.test.ts          # Session discovery, classifySessionTypes(), slug extraction
    │   ├── stats.ts                    # Scans all sessions for aggregate statistics
    │   ├── stats.test.ts              # Stats tests
    │   └── types.ts                    # Raw JSONL line types (RawLine, RawMessage, etc.)
    │
    ├── plugins/
    │   ├── auto-discover.ts            # createRegistry(): auto-discovers plugins whose data dirs exist
    │   ├── registry.ts                 # Typed wrapper over core PluginRegistry
    │   ├── registry.test.ts            # Registry tests
    │   ├── config.ts                   # Compatibility re-exports of package config helpers
    │   ├── config.test.ts              # Config tests
    │   ├── claude-code/
    │   │   ├── index.ts                # Thin wrapper re-exporting package plugin object
    │   │   ├── discovery.ts            # Thin wrapper re-exporting package discovery API
    │   │   ├── parser.ts               # Thin wrapper re-exporting package parser API
    │   │   └── discovery.test.ts       # Discovery tests
    │   ├── codex-cli/
    │   │   ├── index.ts                # Thin wrapper re-exporting package plugin object
    │   │   ├── discovery.ts            # Thin wrapper re-exporting package discovery API
    │   │   ├── parser.ts               # Thin wrapper re-exporting package parser API
    │   │   ├── extractors.ts           # Thin wrapper re-exporting package formatter helpers
    │   │   ├── session-index.ts        # Thin wrapper re-exporting package index API
    │   │   └── discovery.test.ts       # Discovery tests
    │   └── opencode/
    │       ├── index.ts                # Thin wrapper re-exporting package plugin object
    │       ├── discovery.ts            # Thin wrapper re-exporting package discovery API
    │       ├── parser.ts               # Thin wrapper re-exporting package parser API
    │       ├── extractors.ts           # Thin wrapper re-exporting package formatter helpers
    │       ├── db.ts                   # Thin wrapper re-exporting package DB API
    │       └── discovery.test.ts       # Discovery tests
    │
    └── frontend/
        ├── App.tsx                     # Root component: router, state, hash navigation
        ├── App.css                     # All styles + CSS custom properties (light/dark)
        ├── index.css                   # Global reset + base styles
        ├── rpc.ts                      # RPC client module (setRPCClient, getRPC)
        ├── svg.d.ts                    # SVG module declarations for TypeScript
        ├── plugin-registry.ts          # Frontend plugin registry (summary extractors, input formatters)
        ├── view-state.ts               # View state types
        ├── sidebar-content.tsx         # Sidebar content routing
        ├── test-helpers/
        │   └── mock-rpc.ts             # setupMockRPC() for test environment
        ├── components/
        │   ├── dashboard/
        │   │   └── DashboardStats.tsx  # Homepage statistics (projects, sessions, tokens, models)
        │   ├── layout/
        │   │   ├── Layout.tsx          # Sidebar + main content flex wrapper
        │   │   ├── Header.tsx          # Top bar: title, theme, font size, back link
        │   │   └── Sidebar.tsx         # Fixed 320px left sidebar
        │   ├── message/
        │   │   ├── MessageList.tsx     # Maps Turn[] to message components
        │   │   ├── UserMessage.tsx     # User bubble: text, commands, attachments
        │   │   ├── AssistantMessage.tsx # Assistant: thinking + text + tool calls
        │   │   ├── ToolCall.tsx        # Collapsible tool call with smart summary
        │   │   ├── SmartToolOutput.tsx # Tool output: format detection, images, lightbox
        │   │   ├── BashToolContent.tsx # Bash tool input/output display
        │   │   ├── ThinkingBlock.tsx   # Collapsible thinking/reasoning block
        │   │   └── SubAgentView.tsx    # Inline sub-agent session display
        │   ├── session/
        │   │   ├── SessionView.tsx     # Normal session display (fetches + renders)
        │   │   ├── SessionPresentation.tsx  # Presentation mode with step navigation
        │   │   ├── PresentationShell.tsx    # Shared presentation wrapper (keyboard, progress)
        │   │   └── SubAgentPresentation.tsx # Sub-agent presentation mode
        │   ├── project/
        │   │   ├── ProjectList.tsx     # Home view: all projects
        │   │   ├── SessionList.tsx     # Sidebar: sessions for selected project
        │   │   └── HiddenProjectList.tsx  # Hidden projects management view
        │   ├── search/
        │   │   └── SearchModal.tsx     # Global session search (Cmd+K)
        │   └── ui/
        │       ├── MarkdownRenderer.tsx  # react-markdown + GFM + file ref detection
        │       ├── CodeBlock.tsx       # Syntax-highlighted code (Prism)
        │       ├── CollapsibleSection.tsx  # Reusable expand/collapse
        │       ├── DiffView.tsx        # Side-by-side diff display for Edit tool
        │       ├── ErrorBoundary.tsx   # React error boundary with retry
        │       ├── FetchError.tsx      # Error display component
        │       └── ImageLightbox.tsx   # Fullscreen image lightbox overlay
        ├── hooks/
        │   ├── useTheme.ts            # Light/dark/system theme + font size persistence
        │   ├── useRPC.ts              # Generic RPC data fetching hook with loading/error state
        │   ├── useSessionData.ts      # Session data fetching hook
        │   ├── useHiddenProjects.ts   # Hidden projects state + localStorage persistence
        │   ├── usePresentationMode.ts # Step-through state machine
        │   ├── useKeyboard.ts         # Arrow/Space/Esc/F key bindings
        │   └── useViewState.ts        # View state management hook
        └── utils/
            ├── time.ts                # Relative time formatting + timestamp display
            ├── model.ts               # Model name shortening (Opus/Sonnet/Haiku)
            ├── project.ts             # Project path utilities
            ├── format-detector.ts     # Auto-detect output format (JSON, XML, diff, etc.)
            └── plugin.ts              # Plugin display name mapping
```

## Data Flow

```
Data Sources                            # Each tool stores sessions differently
  ~/.claude/projects/**/*.jsonl         # Claude Code: JSONL files in encoded-path dirs
  ~/.codex/sessions/**/*.jsonl          # Codex CLI: JSONL files in nested dirs
  ~/.local/share/opencode/opencode.db   # OpenCode: SQLite database (messages + parts)
          │
          ▼
   Plugin Packages                      # Each plugin implements ToolPlugin from core package
     @cookielab.io/klovi-plugin-claude-code
     @cookielab.io/klovi-plugin-codex
     @cookielab.io/klovi-plugin-opencode
          │
          ▼
   @cookielab.io/klovi-plugin-core      # Shared contracts + registry implementation
     plugin-types.ts                    # ToolPlugin, PluginProject, MergedProject, capabilities
     plugin-registry.ts                 # discoverAllProjects() / listAllSessions()
          │
          ▼
   App PluginRegistry Wrapper           # App-specific typed wrapper over core registry
     auto-discover.ts: createRegistry() # Auto-discovers plugins whose data dirs exist
     registry.ts                        # discoverAllProjects() → MergedProject[]
                                        # listAllSessions() → SessionSummary[]
          │
          ▼
   RPC Handlers (rpc-handlers.ts)       # Called by Electrobun typed RPC from webview
          │
     Electrobun RPC                     # Typed WebSocket bridge between Bun and webview
          │
          ▼
   Webview (views/main/index.ts)        # Electroview RPC client, React mount
          │
          ▼
   App.tsx                              # Frontend: RPC calls via getRPC(), manages view state
   MessageList.tsx                      # Maps Turn[] to components
   UserMessage / AssistantMessage       # Render each turn type
   ToolCall / ThinkingBlock             # Render sub-elements (pluginId-aware)
```

## Main Process

The main process runs in Bun via Electrobun (`src/bun/index.ts`). It:

1. Creates a `PluginRegistry` via `createRegistry()` (auto-discovers installed tools)
2. Defines typed RPC handlers using `BrowserView.defineRPC<KloviRPC>()`
3. Opens a `BrowserWindow` pointing to `views://main/index.html`
4. Sets up the `ApplicationMenu` with Edit, View, and Window menus
5. Forwards menu actions (theme cycling, font size, presentation toggle) to the webview via RPC messages

### RPC Methods

| RPC Method | Handler | Purpose |
|---|---|---|
| `getVersion` | `getVersion()` | App version information |
| `getStats` | `getStats()` | Aggregate dashboard statistics (projects, sessions, tokens, models) |
| `getProjects` | `getProjects()` | Lists all discovered projects |
| `getSessions` | `getSessions()` | Lists sessions for a project by `encodedPath` |
| `getSession` | `getSession()` | Returns full parsed session (with plan/impl linking) |
| `getSubAgent` | `getSubAgent()` | Returns sub-agent session |
| `searchSessions` | `searchSessions()` | Returns all sessions across all projects for search |

### RPC Messages (Main → Webview)

| Message | Purpose |
|---|---|
| `cycleTheme` | Cycle through light/dark/system themes |
| `increaseFontSize` | Increase font size |
| `decreaseFontSize` | Decrease font size |
| `togglePresentation` | Toggle presentation mode |

### Build Pipeline

The app is built with Electrobun:

- **Development**: `bun run dev` starts the main process with hot reload and opens the webview
- **Production**: `bun run build` produces a native desktop binary

Electrobun handles bundling both the Bun main process (`src/bun/index.ts`) and the webview entry (`src/views/main/index.ts`), including all React/CSS assets. The `electrobun.config.ts` defines entrypoints and view mappings.

## Frontend Router

Hash-based routing in `App.tsx`:

| Hash | ViewState | Content |
|---|---|---|
| `#/` | `{ kind: "home" }` | ProjectList in sidebar, empty main |
| `#/hidden` | `{ kind: "hidden" }` | HiddenProjectList |
| `#/:encodedPath` | `{ kind: "project", project }` | SessionList in sidebar, empty main |
| `#/:encodedPath/:sessionId` | `{ kind: "session", project, session }` | SessionList in sidebar, SessionView or SessionPresentation in main |
| `#/:encodedPath/:sessionId/subagent/:agentId` | `{ kind: "subagent", ... }` | Sub-agent session view or SubAgentPresentation |

Navigation uses `history.pushState` + `popstate` listener for back/forward.

## Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── ProjectList          (home)
│   │   └── SessionList          (project/session views)
│   └── main
│       ├── Header               (always visible, with backHref + sessionType badge)
│       ├── DashboardStats       (home view, fetches via RPC)
│       ├── empty-state          (home/project)
│       ├── HiddenProjectList    (hidden projects view)
│       ├── SessionView          (session, normal mode)
│       │   └── MessageList
│       │       ├── UserMessage
│       │       ├── AssistantMessage
│       │       │   ├── ThinkingBlock(s)
│       │       │   ├── MarkdownRenderer (text blocks)
│       │       │   ├── ToolCall(s)
│       │       │   │   └── SmartToolOutput (format detection, images → ImageLightbox)
│       │       │   └── SubAgentView (inline sub-agent)
│       │       └── SystemMessage (inline)
│       ├── SubAgentView         (sub-agent route, normal mode)
│       ├── PresentationShell    (shared presentation wrapper)
│       │   └── MessageList      (with visibility constraints)
│       ├── SessionPresentation  (session, presenting → PresentationShell)
│       └── SubAgentPresentation (sub-agent, presenting → PresentationShell)
```

## Type System

All shared types live in `src/shared/types.ts`:

```
Session { sessionId, project, turns: Turn[], planSessionId?, implSessionId? }
SessionSummary { sessionId, timestamp, slug, firstMessage, model, gitBranch, sessionType? }
Turn = UserTurn | AssistantTurn | SystemTurn

UserTurn { kind: "user", text, command?, attachments?, uuid, timestamp }
AssistantTurn { kind: "assistant", model, contentBlocks: ContentBlock[], usage?, stopReason?, uuid, timestamp }
SystemTurn { kind: "system", text, uuid, timestamp }

ContentBlock = { type: "thinking", block: ThinkingBlock }
            | { type: "text", text: string }
            | { type: "tool_call", call: ToolCallWithResult }

ToolCallWithResult { toolUseId, name, input, result, isError, resultImages? }
TokenUsage { inputTokens, outputTokens, cacheReadTokens?, cacheCreationTokens? }
DashboardStats { projects, sessions, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, toolCalls, models }
```

RPC type schema in `src/shared/rpc-types.ts`:

```
KloviRPC {
  bun: RPCSchema<{ requests: { getVersion, getStats, getProjects, ... }, messages: {} }>
  webview: RPCSchema<{ requests: {}, messages: { cycleTheme, increaseFontSize, ... } }>
}
```

Raw JSONL types in `src/parser/types.ts`:

```
RawLine { type, message?: RawMessage, isMeta?, uuid?, timestamp?, ... }
RawMessage { role, model?, content, stop_reason?, usage? }
RawContentBlock = text | thinking | tool_use | tool_result | image
```

## Styling

Plain CSS with custom properties in `App.css`. No CSS framework.

Two themes defined via CSS variables on `:root` (light) and `[data-theme="dark"]`:

| Variable | Light | Dark |
|---|---|---|
| `--bg-primary` | `#f6f8fa` | `#0d1117` |
| `--text-primary` | `#1f2328` | `#c9d1d9` |
| `--accent` | `#1a7f37` | `#3fb950` |
| `--error` | `#cf222e` | `#f85149` |

Theme selection persisted to `localStorage` key `klovi-theme`. Font size to `klovi-font-size`. Hidden projects to `klovi-hidden-projects`.

## Plugin System

Klovi now uses a workspace package, `@cookielab.io/klovi-plugin-core`, as the single source of truth for plugin contracts and registry behavior.

Current package layout:

- `@cookielab.io/klovi-plugin-core` (implemented)
- `@cookielab.io/klovi-plugin-claude-code` (implemented)
- `@cookielab.io/klovi-plugin-codex` (implemented)
- `@cookielab.io/klovi-plugin-opencode` (implemented)

App-side files under `src/plugins/*` are now thin wrappers used to preserve internal import compatibility while delegating plugin-specific behavior to package exports.

### ToolPlugin Interface (`packages/klovi-plugin-core/src/plugin-types.ts`)

```typescript
interface ToolPlugin {
  id: string;                           // "claude-code", "codex-cli", "opencode"
  displayName: string;                  // "Claude Code", "Codex", "OpenCode"
  getDefaultDataDir(): string | null;   // Default filesystem path for tool data
  discoverProjects(): Promise<PluginProject[]>;
  listSessions(nativeId: string): Promise<SessionSummary[]>;
  loadSession(nativeId: string, sessionId: string): Promise<Session>;
  loadSessionDetail?(nativeId: string, sessionId: string): Promise<{
    session: Session;
    planSessionId?: string;
    implSessionId?: string;
  }>;
  loadSubAgentSession?(params: {
    sessionId: string;
    project: string;
    agentId: string;
  }): Promise<Session>;
  getResumeCommand?(sessionId: string): string | null;
}
```

`loadSessionDetail` and `loadSubAgentSession` are capability hooks used to keep plugin-specific behavior behind the plugin interface, so RPC handlers do not branch on plugin IDs.

### PluginRegistry (`packages/klovi-plugin-core/src/plugin-registry.ts`)

The `PluginRegistry` class manages registered plugins and handles cross-tool merging:

- **`register(plugin)`** — adds a plugin to the registry
- **`discoverAllProjects()`** — calls each plugin's `discoverProjects()`, then merges results by `resolvedPath` (so the same filesystem project discovered by multiple tools becomes one `MergedProject` with multiple `sources`)
- **`listAllSessions(project)`** — aggregates sessions from all sources for a merged project

The app wraps this class in `src/plugins/registry.ts` to bind Klovi's concrete `Session`/`SessionSummary` types.

### Auto-Discovery (`src/plugins/auto-discover.ts`)

`createRegistry()` checks whether each tool's data directory exists on disk and only registers plugins whose data is available. OpenCode additionally checks for the `opencode.db` file.

### Frontend Plugin Registry (`src/frontend/plugin-registry.ts`)

The frontend has its own plugin registry for tool-specific rendering: custom summary extractors and input formatters per tool. Codex CLI tools like `command_execution`, `file_change`, and `web_search` get custom summaries. The registry is keyed by `pluginId`, which flows through from the session data.

## Key Design Decisions

1. **Native desktop app** - uses Electrobun for a native Bun-powered desktop experience with typed RPC between main process and webview
2. **No HTTP server** - data flows via Electrobun's typed RPC, not HTTP endpoints
3. **No server-side database** - reads JSONL files directly for Claude Code and Codex CLI; reads OpenCode's existing SQLite DB
4. **No CSS framework** - custom design system with CSS variables
5. **Turn merging** - consecutive assistant messages merged into one logical turn (tool_result user messages don't break the turn)
6. **Hash routing** - simple client-side navigation without a router library
7. **Chronological content blocks** - assistant turn content stored as a single `contentBlocks` array preserving API order (thinking, text, and tool calls interleaved)
8. **Grouped presentation steps** - consecutive non-text blocks (thinking, tool calls) are revealed together as one step; each text block is its own step
9. **Electrobun typed RPC** - compile-time type safety for all communication between main process and webview via `KloviRPC` schema
10. **Core-first plugin contracts** - plugin interfaces and registry behavior live in `@cookielab.io/klovi-plugin-core`; app code consumes wrappers over this core package
