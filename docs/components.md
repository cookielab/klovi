# Frontend Components

## Dashboard Components

### DashboardStats (`src/frontend/components/dashboard/DashboardStats.tsx`)

Fetches stats via `getRPC().request.getStats()` and displays aggregate statistics on the homepage. Shows:
- **Top row**: project count, session count, tool call count
- **Token card**: input, output, cache read, cache creation tokens (compact formatting: K/M/B with full number on hover)
- **Models card**: sorted list of models with turn counts

Displays a skeleton loading state (3 placeholder cards) while fetching. Returns `null` on error.

## Message Components

### MessageList (`src/frontend/components/message/MessageList.tsx`)

Maps `Turn[]` to the appropriate message component. In presentation mode, respects `visibleTurns` and `visibleSubSteps` from the presentation hook to progressively reveal content.

Passes `planSessionId` to all `UserMessage` components and `implSessionId` only to the first real user turn (for plan→implementation session linking).

### UserMessage (`src/frontend/components/message/UserMessage.tsx`)

Renders user turns. Three display modes:

1. **Status notice** - text wrapped in `[brackets]` → centered, muted, small
2. **Slash command** - has `command` property → green badge with `> /command` prefix
3. **Regular text** - rendered as markdown via MarkdownRenderer

Also shows image attachment badges (media type label, not rendered inline).

Supports plan/implementation session linking:
- When `planSessionId` is provided and the message starts with "Implement the following plan", shows a "View planning session" link
- When `implSessionId` is provided on the first user turn (non-plan message), shows a "View implementation session" link

### AssistantMessage (`src/frontend/components/message/AssistantMessage.tsx`)

Renders assistant turns from the chronological `contentBlocks` array, grouped into presentation steps via `groupContentBlocks()`:

- **Text blocks** → each is its own step (`MarkdownRenderer`)
- **Non-text blocks** (thinking, tool calls) → consecutive runs grouped into a single step
  - Thinking → `ThinkingBlock` (collapsible)
  - Tool calls → `ToolCall` (collapsible)

Shows model shorthand in the header (Opus/Sonnet/Haiku parsed from model string). Displays token usage footer when available.

In presentation mode, limits visible step groups based on `visibleSubSteps` count.

### ToolCall (`src/frontend/components/message/ToolCall.tsx`)

Collapsible tool call display. Accepts an optional `pluginId` prop for tool-specific rendering. Key features:

- **Smart summary** via `getToolSummary()` - shows the most relevant field per tool type
- **Plugin-aware summaries** — when `pluginId` is provided, consults the frontend plugin registry for custom summary extractors (e.g., Codex CLI's `command_execution`, `file_change`, `web_search`)
- **Input display** - JSON-formatted tool input, or plugin-specific formatting via `inputFormatters`
- **Result display** - monospace text, truncated at 5000 chars
- **Error styling** - red text for `isError: true` results
- **Image results** - base64 images rendered as thumbnails, click to open in `ImageLightbox`

#### Tool Summary Mapping

`getToolSummary(name, input)` returns a concise label per tool:

| Tool | Summary shows | Max length |
|---|---|---|
| `Read` | `file_path` | full |
| `Write` | `file_path` | full |
| `Edit` | `file_path` | full |
| `Glob` | `pattern` | full |
| `Grep` | `pattern` | 60 chars |
| `Bash` | `command` | 80 chars |
| `Task` | `description` | 60 chars |
| `WebFetch` | `url` | 60 chars |
| `WebSearch` | `query` | 60 chars |
| `AskUserQuestion` | First question text | 60 chars |
| `Skill` | Skill name | full |
| `TaskCreate` | `subject` | 60 chars |
| `TaskUpdate` | `#<taskId> → <status>` | full |
| `TaskList` | "List all tasks" | full |
| `TaskGet` | `#<taskId>` | full |
| `TaskOutput` | `task_id` | full |
| `TaskStop` | `task_id` or `shell_id` | full |
| `KillShell` | `task_id` or `shell_id` | full |
| `EnterPlanMode` | "Enter plan mode" | full |
| `ExitPlanMode` | "Exit plan mode" | full |
| `NotebookEdit` | `notebook_path` | full |
| `NotebookRead` | `notebook_path` | full |
| `TodoWrite` | `subject` | 60 chars |
| `mcp__*` | Parsed `server: action` | full |
| Others | `null` (shows tool name only) | - |

MCP tools follow the `mcp__<server>__<action>` naming pattern. The server name is extracted and shown as a badge prefix.

### SubAgentView (`src/frontend/components/message/SubAgentView.tsx`)

Displays a sub-agent conversation inline within the parent session. Fetches sub-agent data via `getRPC().request.getSubAgent()` and renders it using `MessageList` with the `isSubAgent` flag.

### ThinkingBlock (`src/frontend/components/message/ThinkingBlock.tsx`)

Collapsible thinking/reasoning block. Shows 100-char preview when collapsed. Content rendered as markdown (italic).

## Layout Components

### Layout (`src/frontend/components/layout/Layout.tsx`)

Flex container: sidebar (320px fixed) + main content area. `hideSidebar` prop hides sidebar in presentation mode.

### Header (`src/frontend/components/layout/Header.tsx`)

Top bar with:
- Title + optional breadcrumb (project path)
- Session type badge ("Plan" or "Impl") when `sessionType` prop is provided
- Copy resume command button (when `copyCommand` prop is provided)
- Back link (when `backHref` prop is provided, used for sub-agent navigation)
- Theme toggle button (cycles: system → light → dark)
- Font size +/- buttons
- Presentation mode toggle (play/stop icon)

### Sidebar (`src/frontend/components/layout/Sidebar.tsx`)

Fixed-width container for project/session lists.

## Project Components

### ProjectList (`src/frontend/components/project/ProjectList.tsx`)

Fetches projects via `getRPC().request.getProjects()` and renders a filterable list. Each project shows name (last 2 path segments), session count, and last activity time.

### SessionList (`src/frontend/components/project/SessionList.tsx`)

Fetches sessions via `getRPC().request.getSessions()` and renders session cards. Each shows first message preview, tool name badge (via `pluginDisplayName()`), git branch, and relative timestamp. Highlights selected session. Sessions with a detected `sessionType` display a colored badge ("Plan" or "Impl") and get a corresponding CSS class for visual distinction.

The sidebar shows the tool name (e.g., "Claude Code", "Codex", "OpenCode") instead of the model name, using the `pluginId` from the session summary.

### HiddenProjectList (`src/frontend/components/project/HiddenProjectList.tsx`)

Displays hidden projects with unhide functionality. Fetches all projects via `getRPC().request.getProjects()` and filters to show only those in the hidden set. Provides an unhide button per project and a back link to the home view.

## Session Components

### SessionView (`src/frontend/components/session/SessionView.tsx`)

Normal session display. Fetches session data via `getRPC().request.getSession()` and passes turns to `MessageList`.

### SessionPresentation (`src/frontend/components/session/SessionPresentation.tsx`)

Presentation mode entry point. Fetches session data and delegates to `PresentationShell` for rendering.

### PresentationShell (`src/frontend/components/session/PresentationShell.tsx`)

Shared presentation wrapper used by both `SessionPresentation` and `SubAgentPresentation`. Manages:
- Step-through state via `usePresentationMode` hook
- Keyboard controls via `useKeyboard` hook
- Auto-scrolling to bottom on step changes
- Progress bar with step counter
- Fullscreen support
- Keyboard shortcut hints overlay

### SubAgentPresentation (`src/frontend/components/session/SubAgentPresentation.tsx`)

Fetches sub-agent session data via `getRPC().request.getSubAgent()` and renders it in `PresentationShell` with the `isSubAgent` flag.

## UI Components

### MarkdownRenderer (`src/frontend/components/ui/MarkdownRenderer.tsx`)

Wraps `react-markdown` with `remark-gfm`. Custom features:
- Detects `@filepath.ext` patterns and highlights them as green badges
- Custom code block routing to `CodeBlock` component
- External links open in new tab (`target="_blank"`)

### CodeBlock (`src/frontend/components/ui/CodeBlock.tsx`)

Syntax-highlighted code using `react-syntax-highlighter` with Prism (oneDark theme). Shows language label when detected.

### CollapsibleSection (`src/frontend/components/ui/CollapsibleSection.tsx`)

Reusable expand/collapse wrapper with animated disclosure. Max height 500px with scroll when expanded.

### ImageLightbox (`src/frontend/components/ui/ImageLightbox.tsx`)

Fullscreen image lightbox overlay. Displays an image centered on a dark backdrop. Click anywhere or press Escape to dismiss. Animates in/out with fade + scale transition (200ms).

Used by `SmartToolOutput` for tool result images (e.g. screenshots from chrome-devtools).

### DiffView (`src/frontend/components/ui/DiffView.tsx`)

Side-by-side diff display for Edit tool results. Shows old and new strings with syntax highlighting.

### ErrorBoundary (`src/frontend/components/ui/ErrorBoundary.tsx`)

React error boundary with retry functionality. Two variants: view-level (full-page fallback) and inline (per-component fallback with retry button).

## Frontend Plugin Registry (`src/frontend/plugin-registry.ts`)

The frontend plugin registry provides tool-specific rendering for ToolCall components. Each registered frontend plugin can provide:

- **`summaryExtractors`** — map of tool name to function that extracts a concise summary string from tool input
- **`inputFormatters`** — map of tool name to function that formats tool input for display

Currently registered plugins:
- **Codex CLI** (`codex-cli`) — extractors for `command_execution`, `file_change`, `web_search`
- **OpenCode** (`opencode`) — empty extractors (uses standard Claude Code tool names)

The `pluginId` prop flows from session data through `AssistantMessage` into each `ToolCall`, where it's used to look up the appropriate plugin for rendering.

## Plugin Utilities (`src/frontend/utils/plugin.ts`)

`pluginDisplayName(pluginId)` maps plugin IDs to human-readable names: `"claude-code"` → `"Claude Code"`, `"codex-cli"` → `"Codex"`, `"opencode"` → `"OpenCode"`.

## Hooks

### useTheme (`src/frontend/hooks/useTheme.ts`)

- Settings: `"system"` (default), `"light"`, `"dark"`
- Persisted to `localStorage` key `klovi-theme`
- Sets `data-theme` attribute on `<html>` element
- Listens to `prefers-color-scheme` media query in system mode
- `cycle()` rotates through: system → light → dark → system

### useFontSize (`src/frontend/hooks/useTheme.ts`)

- Range: 10px to 28px (default 15px)
- Persisted to `localStorage` key `klovi-font-size`
- Sets `--font-size` CSS variable on document

### usePresentationMode (`src/frontend/hooks/usePresentationMode.ts`)

Step-through state machine for presentations:

- Builds a flat step list from turns: each user/system turn = 1 step, each assistant turn = N sub-steps
- Sub-steps use `groupContentBlocks()`: each text block is one step, consecutive non-text blocks (thinking, tool calls) are grouped into one step
- Tracks `visibleTurns` count and `visibleSubSteps` Map (turnIndex → subStepCount)
- Methods: `enter()`, `exit()`, `next()`, `prev()`, `nextTurn()`, `prevTurn()`, `toggleFullscreen()`

### useHiddenProjects (`src/frontend/hooks/useHiddenProjects.ts`)

Manages hidden project state persisted to `localStorage` key `klovi-hidden-projects`:
- `hiddenIds` — `Set<string>` of hidden project encoded paths
- `hide(encodedPath)` — add project to hidden set
- `unhide(encodedPath)` — remove project from hidden set
- `isHidden(encodedPath)` — check if project is hidden

### useKeyboard (`src/frontend/hooks/useKeyboard.ts`)

Keyboard event handler for presentation mode:
- ArrowRight / Space → next step (within a turn)
- ArrowLeft → previous step (within a turn)
- ArrowDown → next turn
- ArrowUp → previous turn
- Escape → exit presentation
- F → toggle fullscreen (without Ctrl/Cmd modifier)
