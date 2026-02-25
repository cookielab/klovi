# `@cookielab.io/klovi-ui` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract Klovi-specific UI components into a reusable `@cookielab.io/klovi-ui` workspace package with domain-scoped sub-exports, CSS Modules, and props-only data flow.

**Architecture:** Components move from `src/frontend/components/` into `packages/klovi-ui/src/` organized by domain (messages, tools, sessions, presentation, search, utilities). All data fetching stays in the main app; UI components receive data via props and emit actions via callbacks. Types move from `src/shared/types.ts` into the UI package.

**Tech Stack:** React 19, TypeScript (strict mode with `noUncheckedIndexedAccess`), CSS Modules, Bun workspace

---

## Reference: Existing Files

**Types:** `src/shared/types.ts` (138 lines) — Turn, Session, ContentBlock, ToolCallWithResult, DashboardStats, etc.

**Content blocks:** `src/shared/content-blocks.ts` (27 lines) — `groupContentBlocks()`

**Message components:** `src/frontend/components/message/` — MessageList (145), UserMessage (115), AssistantMessage (134), ToolCall (346), SmartToolOutput (57), BashToolContent (26), UserBashContent (25), ThinkingBlock (33), SubAgentView (29)

**UI utilities:** `src/frontend/components/ui/` — MarkdownRenderer (95), CodeBlock (41), CollapsibleSection (27), ImageLightbox (38), ErrorBoundary (57), FetchError (19), DiffView (55)

**Session/project:** `src/frontend/components/project/` — ProjectList (107), SessionList (70), HiddenProjectList (exists)

**Other:** DashboardStats (131), SearchModal (157), PresentationShell (in session/), Header (123)

**Utilities:** `src/frontend/utils/` — time.ts (72), model.ts (47), format-detector.ts (102), plugin.ts (10), project.ts (10)

**Hooks:** useRpc (45), useSessionData (18), useViewState (91), usePresentationMode (142), useKeyboard (57), useHiddenProjects (64)

**Plugin registry:** `src/frontend/plugin-registry.ts` (26 lines)

**Tests:** 43 test files in `src/frontend/` covering most components and utilities

**CSS:** `src/frontend/App.css` (~1500 lines, global classes)

**Design system pattern:** `packages/klovi-design-system/` — CSS Modules with `s(styles["prop"])` pattern, `css-modules.d.ts` type declaration

---

### Task 1: Scaffold package

**Files:**
- Create: `packages/klovi-ui/package.json`
- Create: `packages/klovi-ui/tsconfig.json`
- Create: `packages/klovi-ui/src/css-modules.d.ts`
- Create: `packages/klovi-ui/src/index.ts`
- Modify: `package.json` (root — add workspace dependency)

**Step 1: Create package.json**

```json
{
  "name": "@cookielab.io/klovi-ui",
  "version": "0.1.0",
  "description": "Klovi-specific UI components for session viewing, message rendering, and tool display",
  "type": "module",
  "license": "MIT",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./messages": "./src/messages/index.ts",
    "./tools": "./src/tools/index.ts",
    "./sessions": "./src/sessions/index.ts",
    "./presentation": "./src/presentation/index.ts",
    "./search": "./src/search/index.ts",
    "./utilities": "./src/utilities/index.ts"
  },
  "files": ["src"],
  "peerDependencies": {
    "@cookielab.io/klovi-design-system": "workspace:*",
    "@cookielab.io/klovi-plugin-core": "workspace:*",
    "react": ">=19",
    "react-dom": ">=19"
  },
  "dependencies": {
    "react-markdown": "^10.1.0",
    "react-syntax-highlighter": "^16.1.0",
    "remark-gfm": "^4.0.1"
  }
}
```

Note: Check root `package.json` for exact versions of react-markdown, react-syntax-highlighter, remark-gfm.

**Step 2: Create tsconfig.json**

Copy pattern from `packages/klovi-design-system/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Step 3: Create css-modules.d.ts**

Copy from `packages/klovi-design-system/src/css-modules.d.ts`:

```ts
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
```

**Step 4: Create empty index.ts**

```ts
// Re-exports from all domains — populated as domains are built
```

**Step 5: Add workspace dependency to root package.json**

Add `"@cookielab.io/klovi-ui": "workspace:*"` to root `dependencies`.

**Step 6: Run `bun install`**

**Step 7: Commit**

```bash
git add packages/klovi-ui/package.json packages/klovi-ui/tsconfig.json \
  packages/klovi-ui/src/css-modules.d.ts packages/klovi-ui/src/index.ts \
  package.json bun.lock
git commit -m "chore(klovi-ui): scaffold package with domain sub-exports"
```

---

### Task 2: Move types

**Files:**
- Create: `packages/klovi-ui/src/types/index.ts`
- Modify: `src/shared/types.ts` — replace definitions with re-exports from UI package

**Step 1: Create types/index.ts**

Move all type/interface definitions from `src/shared/types.ts` (lines 1–138) into `packages/klovi-ui/src/types/index.ts`. This is a straight copy — all exports stay identical.

**Step 2: Update src/shared/types.ts to re-export**

Replace entire file with:

```ts
export type {
  Attachment,
  AssistantTurn,
  ContentBlock,
  DashboardStats,
  GlobalSessionResult,
  ModelTokenUsage,
  ParseErrorTurn,
  Project,
  Session,
  SessionSummary,
  SystemTurn,
  ThinkingBlock,
  TokenUsage,
  ToolCallWithResult,
  ToolResultImage,
  Turn,
  UserTurn,
} from "@cookielab.io/klovi-ui/types";
```

This preserves backward compatibility — all existing imports from `../../shared/types.ts` continue working.

**Step 3: Move groupContentBlocks**

Move `src/shared/content-blocks.ts` logic into `packages/klovi-ui/src/types/index.ts` (or a separate `content-blocks.ts` in the types folder, re-exported from types/index.ts).

Update `src/shared/content-blocks.ts` to re-export:

```ts
export { groupContentBlocks } from "@cookielab.io/klovi-ui/types";
```

**Step 4: Update packages/klovi-ui/src/index.ts**

```ts
export * from "./types/index.ts";
```

**Step 5: Run `bun run check`, `bun run typecheck`, `bun test`**

All 719 tests must still pass since `src/shared/types.ts` re-exports everything.

**Step 6: Commit**

```bash
git commit -m "refactor(types): move shared types to @cookielab.io/klovi-ui"
```

---

### Task 3: Move utility functions (formatters)

**Files:**
- Create: `packages/klovi-ui/src/utilities/formatters.ts`
- Create: `packages/klovi-ui/src/utilities/format-detector.ts`
- Create: `packages/klovi-ui/src/utilities/index.ts`
- Modify: `src/frontend/utils/time.ts` — re-export from UI package
- Modify: `src/frontend/utils/model.ts` — re-export from UI package
- Modify: `src/frontend/utils/format-detector.ts` — re-export from UI package
- Modify: `src/frontend/utils/plugin.ts` — stays (depends on plugin-core)
- Modify: `src/frontend/utils/project.ts` — stays (depends on types, simple utility)

**Step 1: Create formatters.ts**

Combine time.ts (72 lines) and model.ts (47 lines) content:

```ts
// Time formatters — from src/frontend/utils/time.ts
export function formatTimestamp(iso: string): string { ... }
export function formatRelativeTime(iso: string): string { ... }
export function formatFullDateTime(iso: string): string { ... }
export function formatTime(iso: string): string { ... }

// Model formatters — from src/frontend/utils/model.ts
export function isClaudeModel(model: string): boolean { ... }
export function shortModel(model: string): string { ... }
```

**Step 2: Create format-detector.ts**

Move entire `src/frontend/utils/format-detector.ts` (102 lines) into `packages/klovi-ui/src/utilities/format-detector.ts`.

**Step 3: Create utilities/index.ts**

```ts
export { formatTimestamp, formatRelativeTime, formatFullDateTime, formatTime, isClaudeModel, shortModel } from "./formatters.ts";
export { detectOutputFormat } from "./format-detector.ts";
```

**Step 4: Update app utils to re-export**

`src/frontend/utils/time.ts`:
```ts
export { formatTimestamp, formatRelativeTime, formatFullDateTime, formatTime } from "@cookielab.io/klovi-ui/utilities";
```

`src/frontend/utils/model.ts`:
```ts
export { isClaudeModel, shortModel } from "@cookielab.io/klovi-ui/utilities";
```

`src/frontend/utils/format-detector.ts`:
```ts
export { detectOutputFormat } from "@cookielab.io/klovi-ui/utilities";
```

**Step 5: Update packages/klovi-ui/src/index.ts**

Add: `export * from "./utilities/index.ts";`

**Step 6: Run verification, commit**

```bash
git commit -m "refactor(utils): move formatters and format detector to klovi-ui"
```

---

### Task 4: Create utility components (ErrorBoundary, FetchError, ImageLightbox)

**Files:**
- Create: `packages/klovi-ui/src/utilities/ErrorBoundary.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/utilities/FetchError.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/utilities/ImageLightbox.tsx` + `.module.css`
- Modify: `src/frontend/components/ui/ErrorBoundary.tsx` — re-export
- Modify: `src/frontend/components/ui/FetchError.tsx` — re-export
- Modify: `src/frontend/components/ui/ImageLightbox.tsx` — re-export

**Approach for each component:**

1. Copy the component `.tsx` file to the UI package
2. Extract its CSS classes from `App.css` into a `.module.css` file
3. Rewrite the component to use CSS modules with the `s(styles["prop"])` pattern
4. Update the app component to re-export from the UI package
5. Update the utilities `index.ts` barrel

**CSS extraction reference (from App.css):**

- ErrorBoundary: `.error-view`, `.error-view-title`, `.error-view-message`, `.error-card`, `.error-card-header`, `.error-card-title`, `.error-card-details`, `.error-actions`
- FetchError: `.fetch-error`, `.fetch-error-message`
- ImageLightbox: `.lightbox-overlay`, `.lightbox-visible`, `.lightbox-image`

**Important:** The ErrorBoundary is a React class component. Keep it as-is but switch to CSS modules.

**Testing note:** Existing tests at `src/frontend/components/ui/ErrorBoundary.test.tsx`, `ImageLightbox.test.tsx` query by global CSS class names (`.error-view`, `.lightbox-overlay`). After switching to CSS modules, these tests need to query by role/text instead of class names. Update the test queries to use `getByRole`, `getByText`, or `data-testid` attributes.

**Step N: Run verification, commit**

```bash
git commit -m "refactor(utilities): move ErrorBoundary, FetchError, ImageLightbox to klovi-ui"
```

---

### Task 5: Create tools domain (DiffView, SmartToolOutput, BashToolContent, ToolCall)

**Files:**
- Create: `packages/klovi-ui/src/tools/DiffView.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/tools/SmartToolOutput.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/tools/BashToolContent.tsx`
- Create: `packages/klovi-ui/src/tools/ToolCall.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/tools/index.ts`
- Modify: corresponding `src/frontend/components/` files — re-export

**Key refactoring for ToolCall.tsx (346 lines):**

The current ToolCall has summary extractors and input formatters inlined. Per design decision, split into:

1. **ToolCall shell** — collapsible container with badge, summary line, expand/collapse. Accepts a `renderer` prop or `children` for custom tool-specific rendering. Also accepts `summary` and `icon` props so the caller controls what appears in the collapsed header.

2. **Built-in rendering** — The default rendering logic (summary extractors, input formatters) moves into a wrapper component in the app or a separate file in the UI package. The ToolCall shell itself is generic.

**Recommended split:**

```
packages/klovi-ui/src/tools/
├── ToolCall.tsx          # Shell: collapsible, badge, summary display
├── ToolCallDefaults.tsx  # Default summary extractors + input formatters (the 40+ tool registry)
├── SmartToolOutput.tsx   # Format-detecting output display
├── BashToolContent.tsx   # Bash-specific rendering
├── DiffView.tsx          # Side-by-side diff
└── index.ts
```

`ToolCall.tsx` props:
```tsx
interface ToolCallProps {
  tool: ToolCallWithResult;
  defaultOpen?: boolean;
  pluginId?: string;
  // Optional overrides — if not provided, uses built-in defaults
  summary?: string;
  children?: React.ReactNode;  // Custom body content
}
```

`ToolCallDefaults.tsx` exports:
```ts
export function getToolSummary(call: ToolCallWithResult, pluginId?: string): string;
export function formatToolInput(call: ToolCallWithResult): React.ReactNode;
export const MAX_OUTPUT_LENGTH: number;
export const MAX_THINKING_PREVIEW: number;
export function truncateOutput(text: string, max?: number): string;
```

**CSS extraction:** `.tool-call`, `.tool-call-input`, `.tool-call-name`, `.tool-call-summary`, `.tool-call-error`, `.tool-mcp-server`, `.tool-skill-badge`, `.tool-section-label`, `.subagent-link`, `.exec-tree`, `.tree-node`

**Plugin integration:** The `getFrontendPlugin()` call in ToolCall stays in the app-side wrapper or is passed as a prop. The UI package's ToolCallDefaults handles standard Claude Code tools; plugin-specific summaries come from the plugin packages via the existing `FrontendPlugin` interface.

**Testing:** ToolCall.test.tsx has extensive tests. After migration, tests need to be updated for CSS module class names. Use `getByText` and semantic queries instead of class-based queries.

**Step N: Run verification, commit**

```bash
git commit -m "refactor(tools): move tool rendering components to klovi-ui"
```

---

### Task 6: Create messages domain

**Files:**
- Create: `packages/klovi-ui/src/messages/MarkdownRenderer.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/ThinkingBlock.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/UserBashContent.tsx`
- Create: `packages/klovi-ui/src/messages/UserMessage.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/AssistantMessage.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/SubAgentView.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/MessageList.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/messages/index.ts`
- Modify: corresponding `src/frontend/components/` files — re-export

**Order matters — build bottom-up:**
1. MarkdownRenderer (leaf — depends on CodeBlock from DS, react-markdown)
2. ThinkingBlock (depends on MarkdownRenderer, CollapsibleSection from DS)
3. UserBashContent (depends on CodeBlock from DS, SmartToolOutput from tools domain)
4. UserMessage (depends on MarkdownRenderer, UserBashContent)
5. AssistantMessage (depends on MarkdownRenderer, ThinkingBlock, ToolCall from tools domain, groupContentBlocks from types)
6. SubAgentView (depends on MessageList — circular, but SubAgentView receives pre-fetched turns as props now)
7. MessageList (depends on UserMessage, AssistantMessage, ErrorBoundary from utilities)

**Key refactoring:**

- **MarkdownRenderer**: Remove `getRPC()` call for opening external links. Instead, accept `onLinkClick?: (url: string) => void` prop. The app passes the RPC handler.

- **UserMessage**: Remove `planSessionId`/`implSessionId` direct props from current implementation. Instead, accept `onSessionLink?: (sessionId: string) => void` callback.

- **AssistantMessage**: Currently receives `sessionId`, `project`, `pluginId` for passing to ToolCall children. Keep passing these through or simplify to just `pluginId` since ToolCall needs it for plugin summaries.

- **SubAgentView**: Currently calls `useSubAgentSessionData()` hook (RPC). Convert to props-only: receives `turns`, `loading`, `error`. The app fetches data.

- **MessageList**: Currently a simple mapper. Keep it simple — maps Turn[] to UserMessage/AssistantMessage components.

**CSS extraction:** `.message-list`, `.turn`, `.turn-header`, `.turn-badge`, `.turn-badge-*` (user, assistant, agent, sub-agent, system, error), `.turn-badge-model`, `.turn-timestamp`, `.message`, `.message-user`, `.message-assistant`, `.message-root-agent`, `.command-call`, `.command-call-label`, `.attachments`, `.attachment-badge`, `.status-notice`, `.ide-opened-file-notice`, `.subagent-link`, `.markdown-content`, `.file-ref`, `.thinking-block`, `.thinking-content`, `.token-usage`, `.step-enter`, `.active-message`

**Step N: Run verification, commit**

```bash
git commit -m "refactor(messages): move message rendering components to klovi-ui"
```

---

### Task 7: Create sessions domain

**Files:**
- Create: `packages/klovi-ui/src/sessions/ProjectList.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/sessions/SessionList.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/sessions/HiddenProjectList.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/sessions/DashboardStats.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/sessions/index.ts`
- Modify: corresponding `src/frontend/components/` files — re-export

**Key refactoring:**

- **ProjectList**: Currently calls `useRPC(getRPC().request.listProjects, [])`. Convert to props: `projects: Project[]`, `loading`, `error`, `onRetry`. Keep `onSelect`, `onHide`, `onShowHidden` callbacks. Move `projectDisplayName()` to UI package utilities.

- **SessionList**: Currently calls `useRPC(getRPC().request.listSessions, [project.encodedPath])`. Convert to props: `sessions: SessionSummary[]`, `loading`, `error`. Keep `onSelect`, `onBack`. Move `pluginDisplayName()` reference — this stays in app since it depends on `@cookielab.io/klovi-plugin-core`. Accept as prop or include in session data.

- **DashboardStats**: Currently calls `useRPC(getRPC().request.getDashboardStats, [])`. Convert to props: `stats: DashboardStats`, `loading`. The compact number formatting and model simplification functions move to UI package utilities.

- **HiddenProjectList**: Currently has its own data fetching. Convert to props.

**CSS extraction:** `.filter-input`, `.list-item`, `.list-item-with-action`, `.list-item-content`, `.list-item-title`, `.list-item-meta`, `.list-section-title`, `.btn-hide`, `.hidden-projects-link`, `.empty-list-message`, `.loading`, `.back-btn`, `.plugin-badge`, `.session-type-badge`, `.dashboard-stats`, `.stats-row`, `.stat-card`, `.stat-value`, `.stat-label`, `.model-list`, `.model-count`, `.token-row`

**Step N: Run verification, commit**

```bash
git commit -m "refactor(sessions): move project/session list components to klovi-ui"
```

---

### Task 8: Create presentation domain

**Files:**
- Create: `packages/klovi-ui/src/presentation/PresentationShell.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/presentation/index.ts`
- Modify: `src/frontend/components/session/PresentationShell.tsx` — re-export

**Key refactoring:**

PresentationShell currently uses `usePresentationMode()` and `useKeyboard()` hooks internally. These hooks manage step tracking and keyboard navigation. Since they have no RPC calls, they can move to the UI package alongside PresentationShell.

- Move: `src/frontend/hooks/usePresentationMode.ts` → `packages/klovi-ui/src/presentation/usePresentationMode.ts`
- Move: `src/frontend/hooks/useKeyboard.ts` → `packages/klovi-ui/src/presentation/useKeyboard.ts`
- Update app hooks to re-export from UI package

PresentationShell props:
```tsx
interface PresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  onNavigateToSubAgent?: (id: string) => void;
  theme?: ThemeSetting;       // Presentation theme (separate from global)
  fontSize?: number;           // Presentation font size
}
```

**CSS extraction:** `.presentation-mode`, `.fullscreen`, `.presentation-progress`, `.presentation-progress-bar`, `.presentation-progress-fill`, plus any presentation-specific message overrides

**Step N: Run verification, commit**

```bash
git commit -m "refactor(presentation): move PresentationShell and hooks to klovi-ui"
```

---

### Task 9: Create search domain

**Files:**
- Create: `packages/klovi-ui/src/search/SearchModal.tsx` + `.module.css`
- Create: `packages/klovi-ui/src/search/index.ts`
- Modify: `src/frontend/components/search/SearchModal.tsx` — re-export

**Key refactoring:**

SearchModal currently receives `sessions: GlobalSessionResult[]` and handles filtering, keyboard navigation, highlighting internally. This is mostly self-contained.

Convert props:
- Remove any RPC dependency
- Accept `sessions: GlobalSessionResult[]` (pre-fetched by app)
- Accept `onSelect: (result: GlobalSessionResult) => void`
- Accept `onClose: () => void`
- Accept `open: boolean`
- Keep internal state: query, highlighted index, keyboard navigation

**CSS extraction:** `.search-overlay`, `.search-modal`, `.search-input-wrapper`, `.search-input`, `.search-results`, `.search-result-item`, `.search-result-title`, `.search-result-meta`, `.search-empty`, `.search-footer`

**Step N: Run verification, commit**

```bash
git commit -m "refactor(search): move SearchModal to klovi-ui"
```

---

### Task 10: Update app to import from UI package

**Files:**
- Modify: All app components that currently import from `../ui/`, `../message/`, `../project/`, `../search/`
- Modify: `src/frontend/App.css` — remove migrated CSS sections

**Step 1: Update imports in view components**

Files that stay in the app but import UI components:
- `src/frontend/components/session/SessionView.tsx` — import MessageList from `@cookielab.io/klovi-ui/messages`
- `src/frontend/components/session/SessionPresentation.tsx` — import from `@cookielab.io/klovi-ui/presentation`
- `src/frontend/components/session/SubAgentPresentation.tsx` — import from `@cookielab.io/klovi-ui/presentation`
- `src/frontend/components/settings/SettingsView.tsx` — may import utilities
- `src/frontend/App.tsx` — import from various UI package domains

**Step 2: Clean up App.css**

Remove all CSS sections that were migrated to UI package CSS modules. After removal, App.css should contain only:
- Layout overrides specific to the app shell
- Settings styles (SettingsView.css may already be separate)
- Onboarding styles (Onboarding.css may already be separate)
- Any remaining animation keyframes used by app-only components

**Step 3: Verify re-export chain works**

All existing `src/shared/types.ts` and `src/frontend/utils/*.ts` re-exports must resolve correctly. Run full verification.

**Step 4: Run verification, commit**

```bash
git commit -m "refactor(app): import UI components from @cookielab.io/klovi-ui"
```

---

### Task 11: Update tests

**Files:**
- Modify: All test files that query by global CSS class names

**Key changes:**

Tests currently use patterns like:
```ts
container.querySelector(".error-view")
container.querySelector(".lightbox-overlay")
container.querySelector(".tool-call")
container.querySelector(".turn-badge-user")
```

With CSS modules, these class names are hashed. Update tests to use:
1. `getByRole()` — for semantic elements (dialog, button, etc.)
2. `getByText()` — for text content queries
3. `data-testid` attributes — add to components where needed
4. `getByLabelText()` — for form elements

**Test files to update (prioritized by likelihood of CSS class queries):**
- `ErrorBoundary.test.tsx`
- `ImageLightbox.test.tsx`
- `ToolCall.test.tsx`
- `DiffView.test.tsx`
- `MessageList.test.tsx`
- `UserMessage.test.tsx`
- `AssistantMessage.test.tsx`
- `SmartToolOutput.test.tsx`
- `ThinkingBlock.test.tsx`
- `ProjectList.test.tsx`
- `SessionList.test.tsx`
- `SearchModal.test.tsx`
- `PresentationShell.test.tsx`
- `DashboardStats.test.tsx`
- `Layout.test.tsx`
- `Header.test.tsx`
- `Sidebar.test.tsx`

**Important:** Run `bun test` after each batch of test updates to catch breakage early. Do not update all tests at once.

**Step N: Run full verification, commit**

```bash
git commit -m "test: update tests for CSS module migration"
```

---

### Task 12: Move remaining dependencies

**Files:**
- Modify: `package.json` (root) — move react-markdown, remark-gfm to UI package
- Modify: `packages/klovi-ui/package.json` — verify all dependencies

**Step 1: Audit dependencies**

Check which packages are only used by UI components (not app-level code):
- `react-markdown` — only used by MarkdownRenderer → move to UI package deps
- `remark-gfm` — only used by MarkdownRenderer → move to UI package deps
- `react-syntax-highlighter` — used by CodeBlock/DiffView and DS CodeBox → keep in both

**Step 2: Move deps, run `bun install`, verify**

**Step 3: Commit**

```bash
git commit -m "chore(deps): move markdown dependencies to klovi-ui package"
```

---

### Task 13: Final cleanup and verification

**Step 1: Run full verification**

```bash
bun run check      # Biome lint + format
bun run typecheck  # TypeScript
bun test           # All tests
```

**Step 2: Verify no circular dependencies**

Check that:
- `@cookielab.io/klovi-ui` does NOT import from `src/frontend/`
- `src/shared/types.ts` re-exports from `@cookielab.io/klovi-ui/types` (not circular)
- `src/frontend/utils/*.ts` re-exports from `@cookielab.io/klovi-ui/utilities`

**Step 3: Review App.css**

Ensure App.css only contains app-specific styles. All component styles should be in CSS modules.

**Step 4: Final commit**

```bash
git commit -m "refactor(klovi-ui): complete UI package extraction"
```

---

## Verification Checklist

After all tasks:

- [ ] `bun install` succeeds
- [ ] `bun run check` passes (0 errors)
- [ ] `bun run typecheck` passes (0 errors)
- [ ] `bun test` — all 719+ tests pass
- [ ] `bun run dev` — app launches, visual parity
- [ ] Light theme + dark theme both work
- [ ] Message rendering (user, assistant, tool calls) looks correct
- [ ] Sidebar (project list, session list) works
- [ ] Search modal (Cmd+K) works
- [ ] Presentation mode works
- [ ] Sub-agent views expand correctly
- [ ] No console errors
