# Testing

## Setup

Tests use `bun test` with happy-dom for DOM simulation.

**Config** (`bunfig.toml`):
```toml
[test]
preload = ["./test-setup.ts"]
```

**DOM setup** (`test-setup.ts`):
```ts
import { GlobalWindow } from "happy-dom";
// Registers window, document, etc. as globals
```

happy-dom v20 uses `GlobalWindow` (not `GlobalRegistrator` which was removed).

## Running Tests

```bash
bun test                    # All tests
bun test src/server         # Server tests only
bun test src/frontend       # Frontend tests only
bun test --watch            # Watch mode
```

**Current:** 469 tests across 44 files

## Test Files

| File | What it covers |
|---|---|
| **Server** | |
| `src/server/parser/session.test.ts` | `buildTurns()`, `extractSubAgentMap()`, contentBlocks ordering, plan/impl linking |
| `src/server/parser/command-message.test.ts` | `parseCommandMessage()`, `cleanCommandMessage()` |
| `src/server/parser/claude-dir.test.ts` | Session discovery, `classifySessionTypes()`, slug extraction |
| `src/server/parser/stats.test.ts` | `scanStats()` aggregate statistics computation |
| `src/server/api/version.test.ts` | Version API handler |
| `src/server/cli.test.ts` | CLI arg parsing, help text |
| `src/server/config.test.ts` | Projects directory configuration |
| `src/server/http.test.ts` | HTTP server, route matching, static files |
| `src/server/version.test.ts` | Version info extraction |
| **Shared** | |
| `src/shared/content-blocks.test.ts` | ContentBlock grouping for presentation steps |
| **Frontend — Components** | |
| `src/frontend/components/message/UserMessage.test.tsx` | Regular text, commands, status notices, attachments, plan/impl links |
| `src/frontend/components/message/AssistantMessage.test.tsx` | Thinking, text, tool calls, model display, token usage |
| `src/frontend/components/message/ToolCall.test.tsx` | `getToolSummary()` for all tool types, MCP parsing |
| `src/frontend/components/message/SmartToolOutput.test.tsx` | Tool output format detection, image rendering |
| `src/frontend/components/message/BashToolContent.test.tsx` | Bash tool input/output display |
| `src/frontend/components/message/MessageList.test.tsx` | Turn-to-component mapping |
| `src/frontend/components/message/ThinkingBlock.test.tsx` | Thinking block rendering |
| `src/frontend/components/message/SubAgentView.test.tsx` | Sub-agent inline display |
| `src/frontend/components/dashboard/DashboardStats.test.tsx` | Dashboard rendering, loading state, model display |
| `src/frontend/components/layout/Header.test.tsx` | Header bar rendering |
| `src/frontend/components/layout/Layout.test.tsx` | Layout wrapper |
| `src/frontend/components/layout/Sidebar.test.tsx` | Sidebar rendering |
| `src/frontend/components/project/ProjectList.test.tsx` | Project list rendering |
| `src/frontend/components/project/SessionList.test.tsx` | Session list rendering |
| `src/frontend/components/project/HiddenProjectList.test.tsx` | Hidden projects management |
| `src/frontend/components/session/SessionView.test.tsx` | Session view rendering |
| `src/frontend/components/session/SessionPresentation.test.tsx` | Session presentation mode |
| `src/frontend/components/session/PresentationShell.test.tsx` | Presentation shell wrapper |
| `src/frontend/components/session/SubAgentPresentation.test.tsx` | Sub-agent presentation mode |
| `src/frontend/components/search/SearchModal.test.tsx` | Global search modal |
| `src/frontend/components/ui/CodeBlock.test.tsx` | Syntax-highlighted code |
| `src/frontend/components/ui/CollapsibleSection.test.tsx` | Expand/collapse wrapper |
| `src/frontend/components/ui/DiffView.test.tsx` | Diff view rendering |
| `src/frontend/components/ui/ErrorBoundary.test.tsx` | Error boundary with retry |
| `src/frontend/components/ui/MarkdownRenderer.test.tsx` | Markdown rendering |
| **Frontend — Hooks** | |
| `src/frontend/hooks/useFetch.test.ts` | Generic data fetching hook |
| `src/frontend/hooks/useHiddenProjects.test.ts` | `useHiddenProjects` hook: hide, unhide, localStorage persistence |
| `src/frontend/hooks/useKeyboard.test.tsx` | Keyboard event handling |
| `src/frontend/hooks/usePresentationMode.test.ts` | Step counting, navigation, turn boundaries, visibility |
| `src/frontend/hooks/useTheme.test.ts` | Theme cycling, font size, localStorage persistence |
| **Frontend — Utils** | |
| `src/frontend/utils/format-detector.test.ts` | Output format auto-detection |
| `src/frontend/utils/time.test.ts` | Relative time strings |
| `src/frontend/utils/model.test.ts` | Model name shortening (Opus/Sonnet/Haiku) |
| `src/frontend/utils/project.test.ts` | Project path utilities |

## Patterns

### Parser Tests

Test `buildTurns()` directly with synthetic `RawLine` arrays:

```ts
import { buildTurns } from "./session.ts";
import type { RawLine } from "./types.ts";

test("merges consecutive assistant lines", () => {
  const lines: RawLine[] = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        model: "claude-opus-4-6",
        content: [{ type: "text", text: "hello" }],
      },
    },
    // ... more lines
  ];
  const turns = buildTurns(lines);
  expect(turns).toHaveLength(1);
  expect(turns[0]!.kind).toBe("assistant");
});
```

### Component Tests

Use `@testing-library/react` with `render` and queries:

```ts
import { render } from "@testing-library/react";
import { UserMessage } from "./UserMessage.tsx";
import type { UserTurn } from "../../../shared/types.ts";

test("renders user text", () => {
  const turn: UserTurn = {
    kind: "user",
    uuid: "test-1",
    timestamp: "2025-01-01T00:00:00Z",
    text: "Hello world",
  };
  const { getByText } = render(<UserMessage turn={turn} />);
  expect(getByText("Hello world")).toBeTruthy();
});
```

### Key Conventions

- Use `!` non-null assertions for array index access (required by `noUncheckedIndexedAccess` in tsconfig)
- Build synthetic data objects matching the shared types
- Parser tests focus on turn merging, filtering, and edge cases
- Component tests focus on rendering output and conditional display
- No mocking of fetch/API - component tests render with static props

## Adding Tests

1. Create `<module>.test.ts` or `<Component>.test.tsx` next to the source file
2. Import from `bun:test` for `test`, `expect`, `describe`, `beforeEach`
3. For components, import `render` from `@testing-library/react`
4. For parser logic, import `buildTurns` and construct `RawLine[]` fixtures
