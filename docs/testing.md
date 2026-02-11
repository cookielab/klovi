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

**Current:** 161 tests across 14 files

## Test Files

| File | What it covers |
|---|---|
| `src/server/parser/session.test.ts` | `buildTurns()`, `extractSubAgentMap()`, contentBlocks ordering, plan/impl linking |
| `src/server/parser/command-message.test.ts` | `parseCommandMessage()`, `cleanCommandMessage()` |
| `src/server/parser/claude-dir.test.ts` | Session discovery, `classifySessionTypes()`, slug extraction |
| `src/server/parser/stats.test.ts` | `scanStats()` aggregate statistics computation |
| `src/frontend/components/message/UserMessage.test.tsx` | Regular text, commands, status notices, attachments, plan/impl links |
| `src/frontend/components/message/AssistantMessage.test.tsx` | Thinking, text, tool calls, model display, token usage |
| `src/frontend/components/message/ToolCall.test.tsx` | `getToolSummary()` for all tool types, MCP parsing |
| `src/frontend/components/dashboard/DashboardStats.test.tsx` | Dashboard rendering, loading state, model display |
| `src/frontend/hooks/useHiddenProjects.test.ts` | `useHiddenProjects` hook: hide, unhide, localStorage persistence |
| `src/frontend/hooks/usePresentationMode.test.ts` | Step counting, navigation, turn boundaries, visibility |
| `src/frontend/hooks/useTheme.test.ts` | Theme cycling, font size, localStorage persistence |
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
