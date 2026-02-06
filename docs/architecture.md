# Architecture

## Project Structure

```
CCvie/
├── index.ts                         # Server entry (Bun.serve, port 3000)
├── index.html                       # HTML template (imports frontend.tsx)
├── package.json
├── tsconfig.json                    # Strict mode, noUncheckedIndexedAccess
├── bunfig.toml                      # Preloads test-setup.ts
├── biome.json                       # Linter + formatter config
├── test-setup.ts                    # Registers happy-dom globals
├── CLAUDE.md                        # Coding guidelines for Claude
├── CONTENT_TYPES.md                 # JSONL content type catalog
│
└── src/
    ├── shared/
    │   └── types.ts                 # Shared type definitions (Turn, Session, Project, etc.)
    │
    ├── server/
    │   ├── api/
    │   │   ├── projects.ts          # GET /api/projects
    │   │   ├── sessions.ts          # GET /api/projects/:path/sessions
    │   │   └── session.ts           # GET /api/sessions/:id?project=...
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
        │   │   ├── Header.tsx       # Top bar: title, theme, font size, presentation toggle
        │   │   └── Sidebar.tsx      # Fixed 320px left sidebar
        │   ├── message/
        │   │   ├── MessageList.tsx   # Maps Turn[] to message components
        │   │   ├── UserMessage.tsx   # User bubble: text, commands, attachments
        │   │   ├── AssistantMessage.tsx  # Assistant: thinking + text + tool calls
        │   │   ├── ToolCall.tsx      # Collapsible tool call with smart summary
        │   │   └── ThinkingBlock.tsx # Collapsible thinking/reasoning block
        │   ├── session/
        │   │   ├── SessionView.tsx       # Normal session display (fetches + renders)
        │   │   └── SessionPresentation.tsx  # Presentation mode with step navigation
        │   ├── project/
        │   │   ├── ProjectList.tsx   # Home view: all projects
        │   │   └── SessionList.tsx   # Sidebar: sessions for selected project
        │   └── ui/
        │       ├── MarkdownRenderer.tsx  # react-markdown + GFM + file ref detection
        │       ├── CodeBlock.tsx     # Syntax-highlighted code (Prism)
        │       └── CollapsibleSection.tsx  # Reusable expand/collapse
        ├── hooks/
        │   ├── useTheme.ts          # Light/dark/system theme + font size persistence
        │   ├── usePresentationMode.ts   # Step-through state machine
        │   └── useKeyboard.ts       # Arrow/Space/Esc key bindings
        └── utils/
            └── time.ts              # Relative time formatting ("2 hours ago")
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

Single `Bun.serve()` in `index.ts` with four routes:

| Route | Handler | Purpose |
|---|---|---|
| `/` | HTML import (`index.html`) | Serves bundled frontend |
| `/api/projects` | `handleProjects()` | Lists all discovered projects |
| `/api/projects/:encodedPath/sessions` | `handleSessions()` | Lists sessions for a project |
| `/api/sessions/:sessionId?project=` | `handleSession()` | Returns full parsed session |

Bun's HTML import system bundles the frontend (TSX, CSS) automatically. HMR enabled in development.

## Frontend Router

Hash-based routing in `App.tsx`:

| Hash | ViewState | Content |
|---|---|---|
| `#/` | `{ kind: "home" }` | ProjectList in sidebar, empty main |
| `#/:encodedPath` | `{ kind: "project", project }` | SessionList in sidebar, empty main |
| `#/:encodedPath/:sessionId` | `{ kind: "session", project, session }` | SessionList in sidebar, SessionView or SessionPresentation in main |

Navigation uses `history.pushState` + `popstate` listener for back/forward.

## Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── ProjectList          (home)
│   │   └── SessionList          (project/session views)
│   └── main
│       ├── Header               (always visible)
│       ├── empty-state          (home/project)
│       ├── SessionView          (session, normal mode)
│       │   └── MessageList
│       │       ├── UserMessage
│       │       ├── AssistantMessage
│       │       │   ├── ThinkingBlock(s)
│       │       │   ├── MarkdownRenderer (text blocks)
│       │       │   └── ToolCall(s)
│       │       └── SystemMessage (inline)
│       └── SessionPresentation  (session, presenting)
│           └── MessageList      (with visibility constraints)
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

Theme selection persisted to `localStorage` key `ccvie-theme`. Font size to `ccvie-font-size`.

## Key Design Decisions

1. **No database** - reads JSONL files directly from `~/.claude/projects/`
2. **No build tool** - Bun's native HTML import bundling
3. **No CSS framework** - custom design system with CSS variables
4. **Turn merging** - consecutive assistant messages merged into one logical turn (tool_result user messages don't break the turn)
5. **Hash routing** - simple client-side navigation without a router library
6. **Sub-step presentation** - assistant turns decomposed into thinking/text/tool-call steps for presentation mode
