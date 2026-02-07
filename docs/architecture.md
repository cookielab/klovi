# Architecture

## Project Structure

```
Klovi/
├── index.ts                         # Server entry (CLI flags, route wiring, static dir)
├── index.html                       # HTML template (imports frontend.tsx, built by Bun)
├── package.json
├── tsconfig.json                    # Strict mode, noUncheckedIndexedAccess
├── bunfig.toml                      # Preloads test-setup.ts
├── biome.json                       # Linter + formatter config
├── test-setup.ts                    # Registers happy-dom globals
├── CLAUDE.md                        # Coding guidelines for Claude
├── CONTENT_TYPES.md                 # JSONL content type catalog
│
├── scripts/
│   └── build-server.ts             # Bundles server for Node.js, injects version/commit
│
└── src/
    ├── shared/
    │   └── types.ts                 # Shared type definitions (Turn, Session, Project, etc.)
    │
    ├── server/
    │   ├── config.ts                # Projects directory configuration
    │   ├── http.ts                  # HTTP server (node:http), route matching, static files
    │   ├── version.ts               # Version info from package.json
    │   ├── api/
    │   │   ├── projects.ts          # GET /api/projects
    │   │   ├── sessions.ts          # GET /api/projects/:path/sessions
    │   │   ├── session.ts           # GET /api/sessions/:id?project=...
    │   │   ├── subagent.ts          # GET /api/sessions/:id/subagents/:agentId?project=...
    │   │   └── version.ts           # GET /api/version
    │   └── parser/
    │       ├── claude-dir.ts        # Project/session discovery from ~/.claude/projects/
    │       ├── session.ts           # JSONL parser: parseSession(), buildTurns()
    │       ├── command-message.ts   # Slash command XML extraction
    │       └── types.ts             # Raw JSONL line types (RawLine, RawMessage, etc.)
    │
    └── frontend/
        ├── App.tsx                  # Root component: router, state, hash navigation
        ├── App.css                  # All styles + CSS custom properties (light/dark)
        ├── index.css                # Global reset + base styles
        ├── components/
        │   ├── layout/
        │   │   ├── Layout.tsx       # Sidebar + main content flex wrapper
        │   │   ├── Header.tsx       # Top bar: title, theme, font size, copy command, back link
        │   │   └── Sidebar.tsx      # Fixed 320px left sidebar
        │   ├── message/
        │   │   ├── MessageList.tsx   # Maps Turn[] to message components
        │   │   ├── UserMessage.tsx   # User bubble: text, commands, attachments
        │   │   ├── AssistantMessage.tsx  # Assistant: thinking + text + tool calls
        │   │   ├── ToolCall.tsx      # Collapsible tool call with smart summary
        │   │   ├── ThinkingBlock.tsx # Collapsible thinking/reasoning block
        │   │   └── SubAgentView.tsx  # Inline sub-agent session display
        │   ├── session/
        │   │   ├── SessionView.tsx       # Normal session display (fetches + renders)
        │   │   ├── SessionPresentation.tsx  # Presentation mode with step navigation
        │   │   ├── PresentationShell.tsx    # Shared presentation wrapper (keyboard, progress)
        │   │   └── SubAgentPresentation.tsx # Sub-agent presentation mode
        │   ├── project/
        │   │   ├── ProjectList.tsx   # Home view: all projects
        │   │   ├── SessionList.tsx   # Sidebar: sessions for selected project
        │   │   └── HiddenProjectList.tsx  # Hidden projects management view
        │   └── ui/
        │       ├── MarkdownRenderer.tsx  # react-markdown + GFM + file ref detection
        │       ├── CodeBlock.tsx     # Syntax-highlighted code (Prism)
        │       └── CollapsibleSection.tsx  # Reusable expand/collapse
        ├── hooks/
        │   ├── useTheme.ts          # Light/dark/system theme + font size persistence
        │   ├── useHiddenProjects.ts  # Hidden projects state + localStorage persistence
        │   ├── usePresentationMode.ts   # Step-through state machine
        │   └── useKeyboard.ts       # Arrow/Space/Esc/F key bindings
        └── utils/
            ├── time.ts              # Relative time formatting + timestamp display
            ├── model.ts             # Model name shortening (Opus/Sonnet/Haiku)
            └── project.ts           # Project path utilities
```

## Data Flow

```
~/.claude/projects/                     # Source: Claude Code session files
  └── -Users-foo-Workspace-bar/         # Encoded project path
      └── abc123.jsonl                  # Session file (one JSON object per line)
          │
          ▼
   claude-dir.ts                        # Discovery: finds projects + sessions
   session.ts: parseSession()           # Reads JSONL, calls buildTurns()
   session.ts: buildTurns()             # Filters, merges, structures raw lines → Turn[]
          │
          ▼
   API handlers (projects.ts,           # Serve as JSON responses
   sessions.ts, session.ts)
          │
          ▼
   App.tsx                              # Frontend: fetches, manages view state
   MessageList.tsx                      # Maps Turn[] to components
   UserMessage / AssistantMessage       # Render each turn type
   ToolCall / ThinkingBlock             # Render sub-elements
```

## Server

Custom `node:http` server in `src/server/http.ts` with route matching and static file serving. Routes are wired in `index.ts`:

| Route | Handler | Purpose |
|---|---|---|
| `/*` | Static file serving | Serves pre-built frontend from `dist/public/` |
| `/api/version` | `handleVersion()` | Server version information |
| `/api/projects` | `handleProjects()` | Lists all discovered projects |
| `/api/projects/:encodedPath/sessions` | `handleSessions()` | Lists sessions for a project |
| `/api/sessions/:sessionId?project=` | `handleSession()` | Returns full parsed session |
| `/api/sessions/:sessionId/subagents/:agentId?project=` | `handleSubAgent()` | Returns sub-agent session |

### Build Pipeline

The frontend is built with `bun build` (HTML imports) into `dist/public/`. The server is bundled with `bun build --target node` into `dist/server.js` with a Node.js shebang for CLI execution. In development, `bun --watch index.ts` serves the pre-built frontend with auto-reload.

### CLI Flags

| Flag | Description |
|---|---|
| `--help` / `-h` | Show usage information and exit |
| `--port <number>` | Specify server port (default: 3583) |
| `--projects-dir <path>` | Override the Claude projects directory |
| `--accept-risks` | Skip the startup security warning |

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
│       ├── Header               (always visible, with copyCommand + backHref)
│       ├── empty-state          (home/project)
│       ├── HiddenProjectList    (hidden projects view)
│       ├── SessionView          (session, normal mode)
│       │   └── MessageList
│       │       ├── UserMessage
│       │       ├── AssistantMessage
│       │       │   ├── ThinkingBlock(s)
│       │       │   ├── MarkdownRenderer (text blocks)
│       │       │   ├── ToolCall(s)
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
Session { sessionId, project, turns: Turn[] }
Turn = UserTurn | AssistantTurn | SystemTurn

UserTurn { kind: "user", text, command?, attachments?, uuid, timestamp }
AssistantTurn { kind: "assistant", model, thinkingBlocks, textBlocks, toolCalls, usage?, stopReason?, uuid, timestamp }
SystemTurn { kind: "system", text, uuid, timestamp }

ToolCallWithResult { toolUseId, name, input, result, isError, resultImages? }
TokenUsage { inputTokens, outputTokens, cacheReadTokens?, cacheCreationTokens? }
```

Raw JSONL types in `src/server/parser/types.ts`:

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

## Key Design Decisions

1. **No database** - reads JSONL files directly from `~/.claude/projects/`
2. **No build tool** - Bun's native HTML import bundling
3. **No CSS framework** - custom design system with CSS variables
4. **Turn merging** - consecutive assistant messages merged into one logical turn (tool_result user messages don't break the turn)
5. **Hash routing** - simple client-side navigation without a router library
6. **Sub-step presentation** - assistant turns decomposed into thinking/text/tool-call steps for presentation mode
