# Frontend Components

## Message Components

### MessageList (`src/frontend/components/message/MessageList.tsx`)

Maps `Turn[]` to the appropriate message component. In presentation mode, respects `visibleTurns` and `visibleSubSteps` from the presentation hook to progressively reveal content.

### UserMessage (`src/frontend/components/message/UserMessage.tsx`)

Renders user turns. Three display modes:

1. **Status notice** - text wrapped in `[brackets]` → centered, muted, small
2. **Slash command** - has `command` property → green badge with `> /command` prefix
3. **Regular text** - rendered as markdown via MarkdownRenderer

Also shows image attachment badges (media type label, not rendered inline).

### AssistantMessage (`src/frontend/components/message/AssistantMessage.tsx`)

Renders assistant turns as ordered sub-steps:

1. **Thinking blocks** → `ThinkingBlock` component (collapsible)
2. **Text blocks** → `MarkdownRenderer` for each block
3. **Tool calls** → `ToolCall` component for each (collapsible)

Shows model shorthand in the header (Opus/Sonnet/Haiku parsed from model string). Displays token usage footer when available.

In presentation mode, limits visible sub-steps based on `visibleSubSteps` count.

### ToolCall (`src/frontend/components/message/ToolCall.tsx`)

Collapsible tool call display. Key features:

- **Smart summary** via `getToolSummary()` - shows the most relevant field per tool type
- **Input display** - JSON-formatted tool input
- **Result display** - monospace text, truncated at 5000 chars
- **Error styling** - red text for `isError: true` results
- **Image results** - base64 images rendered as thumbnails with zoom

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
| `mcp__*` | Parsed `server: action` | full |
| Others | `null` (shows tool name only) | - |

MCP tools follow the `mcp__<server>__<action>` naming pattern. The server name is extracted and shown as a badge prefix.

### ThinkingBlock (`src/frontend/components/message/ThinkingBlock.tsx`)

Collapsible thinking/reasoning block. Shows 100-char preview when collapsed. Content rendered as markdown (italic).

## Layout Components

### Layout (`src/frontend/components/layout/Layout.tsx`)

Flex container: sidebar (320px fixed) + main content area. `hideSidebar` prop hides sidebar in presentation mode.

### Header (`src/frontend/components/layout/Header.tsx`)

Top bar with:
- Title + optional breadcrumb (project path)
- Theme toggle button (cycles: system → light → dark)
- Font size +/- buttons
- Presentation mode toggle (play/stop icon)

### Sidebar (`src/frontend/components/layout/Sidebar.tsx`)

Fixed-width container for project/session lists.

## Project Components

### ProjectList (`src/frontend/components/project/ProjectList.tsx`)

Fetches `/api/projects` and renders a filterable list. Each project shows name (last 2 path segments), session count, and last activity time.

### SessionList (`src/frontend/components/project/SessionList.tsx`)

Fetches `/api/projects/:path/sessions` and renders session cards. Each shows first message preview, model, git branch, and relative timestamp. Highlights selected session.

## Session Components

### SessionView (`src/frontend/components/session/SessionView.tsx`)

Normal session display. Fetches `/api/sessions/:id?project=...` and passes turns to `MessageList`.

### SessionPresentation (`src/frontend/components/session/SessionPresentation.tsx`)

Presentation mode wrapper. Uses `usePresentationMode` hook for step state and `useKeyboard` for controls. Auto-scrolls to bottom on step changes. Shows progress bar at bottom.

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

## Hooks

### useTheme (`src/frontend/hooks/useTheme.ts`)

- Settings: `"system"` (default), `"light"`, `"dark"`
- Persisted to `localStorage` key `ccvie-theme`
- Sets `data-theme` attribute on `<html>` element
- Listens to `prefers-color-scheme` media query in system mode
- `cycle()` rotates through: system → light → dark → system

### useFontSize (`src/frontend/hooks/useTheme.ts`)

- Range: 10px to 28px (default 14px)
- Persisted to `localStorage` key `ccvie-font-size`
- Sets `--font-size` CSS variable on document

### usePresentationMode (`src/frontend/hooks/usePresentationMode.ts`)

Step-through state machine for presentations:

- Builds a flat step list from turns: each user/system turn = 1 step, each assistant turn = N sub-steps
- Sub-step breakdown: (thinking blocks count as 1) + (text blocks count as 1) + (each tool call counts as 1)
- Tracks `visibleTurns` count and `visibleSubSteps` Map (turnIndex → subStepCount)
- Methods: `enter()`, `exit()`, `next()`, `prev()`, `toggleFullscreen()`

### useKeyboard (`src/frontend/hooks/useKeyboard.ts`)

Keyboard event handler for presentation mode:
- ArrowRight / ArrowDown / Space → next step
- ArrowLeft / ArrowUp → previous step
- Escape → exit presentation
- F → toggle fullscreen
