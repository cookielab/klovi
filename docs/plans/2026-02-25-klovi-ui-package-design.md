# Design: `@cookielab.io/klovi-ui` Package

## Context

The Klovi monorepo has a design system (`@cookielab.io/klovi-design-system`) with generic primitives (Button, Badge, Modal, Layout, TurnBox, CodeBox, etc.). The main app still contains ~50 frontend components that implement Klovi-specific UI: message rendering, tool call display, session lists, search, presentation mode.

The goal is to extract these into `@cookielab.io/klovi-ui` so the main app becomes a thin composition layer that wires data to components.

## Decisions

- **Data flow**: Props only. UI package exports pure presentational components. All data fetching stays in the app.
- **CSS approach**: CSS Modules (same as design system).
- **Package structure**: Domain-scoped sub-exports (`/messages`, `/tools`, `/sessions`, etc.).
- **Settings/Onboarding**: Stay in the app (too Klovi-specific).
- **Tool rendering**: ToolCall is a composable shell. Each tool type has a separate renderer component. Plugin packages can provide their own renderers.
- **Types**: UI package owns and exports shared types (Turn, Session, ContentBlock, etc.).

## Package Structure

```
packages/klovi-ui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Re-exports all domains
│   ├── types/
│   │   └── index.ts                # Turn, Session, ContentBlock, etc.
│   ├── messages/
│   │   ├── index.ts
│   │   ├── MessageList.tsx
│   │   ├── MessageList.module.css
│   │   ├── UserMessage.tsx
│   │   ├── UserMessage.module.css
│   │   ├── AssistantMessage.tsx
│   │   ├── AssistantMessage.module.css
│   │   ├── ThinkingBlock.tsx
│   │   ├── ThinkingBlock.module.css
│   │   ├── SubAgentView.tsx
│   │   ├── SubAgentView.module.css
│   │   ├── MarkdownRenderer.tsx
│   │   ├── MarkdownRenderer.module.css
│   │   └── UserBashContent.tsx
│   ├── tools/
│   │   ├── index.ts
│   │   ├── ToolCall.tsx
│   │   ├── ToolCall.module.css
│   │   ├── SmartToolOutput.tsx
│   │   ├── SmartToolOutput.module.css
│   │   ├── BashToolContent.tsx
│   │   ├── DiffView.tsx
│   │   ├── DiffView.module.css
│   │   └── renderers/
│   │       ├── index.ts
│   │       ├── EditToolRenderer.tsx
│   │       ├── ReadToolRenderer.tsx
│   │       ├── BashToolRenderer.tsx
│   │       ├── GlobToolRenderer.tsx
│   │       ├── GrepToolRenderer.tsx
│   │       ├── WriteToolRenderer.tsx
│   │       └── ...
│   ├── sessions/
│   │   ├── index.ts
│   │   ├── ProjectList.tsx
│   │   ├── ProjectList.module.css
│   │   ├── SessionList.tsx
│   │   ├── SessionList.module.css
│   │   ├── HiddenProjectList.tsx
│   │   ├── HiddenProjectList.module.css
│   │   ├── DashboardStats.tsx
│   │   └── DashboardStats.module.css
│   ├── presentation/
│   │   ├── index.ts
│   │   ├── PresentationShell.tsx
│   │   └── PresentationShell.module.css
│   ├── search/
│   │   ├── index.ts
│   │   ├── SearchModal.tsx
│   │   └── SearchModal.module.css
│   └── utilities/
│       ├── index.ts
│       ├── ImageLightbox.tsx
│       ├── ImageLightbox.module.css
│       ├── ErrorBoundary.tsx
│       ├── ErrorBoundary.module.css
│       ├── FetchError.tsx
│       ├── FetchError.module.css
│       └── formatters.ts
```

## Sub-exports

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./messages": "./src/messages/index.ts",
    "./tools": "./src/tools/index.ts",
    "./sessions": "./src/sessions/index.ts",
    "./presentation": "./src/presentation/index.ts",
    "./search": "./src/search/index.ts",
    "./utilities": "./src/utilities/index.ts"
  }
}
```

## Component APIs

### Messages

```tsx
interface MessageListProps {
  turns: Turn[];
  visibleCount?: number;
  activeMessageRef?: React.RefObject<HTMLDivElement>;
}

interface UserMessageProps {
  turn: Turn;
  onSessionLink?: (sessionId: string) => void;
}

interface AssistantMessageProps {
  turn: Turn;
  visibleSteps?: number;
  onSubAgentClick?: (id: string) => void;
}

interface ThinkingBlockProps {
  content: string;
  defaultOpen?: boolean;
}

interface SubAgentViewProps {
  turns: Turn[];
  loading?: boolean;
  error?: string;
}

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (url: string) => void;
}
```

### Tools

```tsx
interface ToolCallProps {
  tool: ToolCallWithResult;
  defaultOpen?: boolean;
  renderer?: React.ComponentType<ToolRendererProps>;
  children?: React.ReactNode;
}

interface ToolRendererProps {
  tool: ToolCallWithResult;
}

interface SmartToolOutputProps {
  output: string;
  isError?: boolean;
  images?: ImageResult[];
}
```

### Sessions

```tsx
interface ProjectListProps {
  projects: ProjectSummary[];
  selectedId?: string;
  hiddenIds?: Set<string>;
  onSelect: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  loading?: boolean;
  error?: string;
}

interface SessionListProps {
  sessions: SessionSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  loading?: boolean;
  error?: string;
}

interface DashboardStatsProps {
  stats: DashboardData;
  loading?: boolean;
}
```

### Presentation

```tsx
interface PresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  onNavigateToSubAgent?: (id: string) => void;
}
```

### Search

```tsx
interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
  onSelect: (sessionId: string) => void;
}
```

### Utilities

```tsx
interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

interface ErrorBoundaryProps {
  mode?: "view" | "inline";
  children: React.ReactNode;
}

interface FetchErrorProps {
  message: string;
  onRetry?: () => void;
}
```

## Types Owned by UI Package

Moved from `src/shared/types.ts`:
- `Turn`, `TurnRole`, `ContentBlock`, `TextBlock`, `ToolUseBlock`, `ToolResultBlock`
- `ThinkingBlock` (content type)
- `ToolCallWithResult`, `ImageResult`
- `Session`, `SessionSummary`, `ProjectSummary`
- `DashboardData`

Utility functions moved from `src/frontend/`:
- `formatRelativeTime`, `formatModelShorthand`, `formatPluginDisplayName`
- `detectFormat` (JSON/XML/diff/code/text detection)
- `groupContentBlocks` (step grouping for assistant messages)

## CSS Migration

Each component gets a `.module.css` file with styles extracted from `App.css`:

| Source (App.css) | Target |
|---|---|
| `.turn`, `.message`, `.turn-header`, `.turn-badge-*` (~200 lines) | `messages/*.module.css` |
| `.tool-call`, `.tool-section-label`, `.diff-view-*` (~150 lines) | `tools/*.module.css` |
| `.list-item`, `.filter-input`, `.plugin-badge` (~100 lines) | `sessions/*.module.css` |
| `.search-*` (~80 lines) | `search/SearchModal.module.css` |
| `.presentation-*` (~50 lines) | `presentation/PresentationShell.module.css` |
| `.error-*`, `.fetch-error`, `.lightbox-*`, `.loading` (~60 lines) | `utilities/*.module.css` |

After extraction, `App.css` retains only settings, onboarding, and any remaining app-specific view styles.

## What Stays in the App

- **Views/Pages**: SessionView, SessionPresentation, SubAgentPresentation, SettingsView, Onboarding
- **Data fetching**: useRPC(), useSessionData(), useSubAgentSessionData() hooks
- **Routing**: Hash router, navigation state
- **Plugin wiring**: Connecting plugin packages to tool renderers
- **App.tsx**: Composes DS ThemeProvider + DS Layout + UI components + app views
- **Settings/Onboarding CSS**: Stays local
