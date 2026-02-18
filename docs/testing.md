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

**Current:** 541 tests across 49 files

## Test Files

### Server — Parser & Infrastructure

| File | What it covers |
|---|---|
| **Server** | |
| `src/server/parser/session.test.ts` | `buildTurns()`, `extractSubAgentMap()`, contentBlocks ordering, plan/impl linking |
| `src/server/parser/command-message.test.ts` | `parseCommandMessage()`, `cleanCommandMessage()` |
| `src/server/parser/claude-dir.test.ts` | Session discovery, `classifySessionTypes()`, slug extraction |
| `src/server/parser/stats.test.ts` | `scanStats()` aggregate statistics computation |
| `src/server/plugin-registry.test.ts` | PluginRegistry: project merging, session aggregation |
| `src/server/config.test.ts` | Config getters/setters for all tool directories |
| `src/server/cli.test.ts` | CLI arg parsing, dir flags, port validation |
| `src/server/http.test.ts` | HTTP server route matching |
| `src/server/version.test.ts` | Version info |
| `src/server/api/version.test.ts` | Version API handler |
| **Shared** | |
| `src/shared/content-blocks.test.ts` | ContentBlock grouping for presentation steps |

### Server — Tool Plugins

| File | What it covers |
|---|---|
| `src/server/plugins/codex-cli/discovery.test.ts` | Codex CLI project/session discovery from nested JSONL dirs |
| `src/server/plugins/codex-cli/parser.test.ts` | `buildCodexTurns()` from JSONL events |
| `src/server/plugins/opencode/discovery.test.ts` | OpenCode project/session discovery from SQLite |
| `src/server/plugins/opencode/parser.test.ts` | `buildOpenCodeTurns()` from SQLite messages/parts |

### Frontend — Components

| File | What it covers |
|---|---|
| `src/frontend/components/message/UserMessage.test.tsx` | Regular text, commands, status notices, attachments, plan/impl links |
| `src/frontend/components/message/AssistantMessage.test.tsx` | Thinking, text, tool calls, model display, token usage |
| `src/frontend/components/message/ToolCall.test.tsx` | `getToolSummary()` for all tool types, MCP parsing |
| `src/frontend/components/message/SmartToolOutput.test.tsx` | Tool output format detection, image rendering |
| `src/frontend/components/message/BashToolContent.test.tsx` | Bash tool input/output display |
| `src/frontend/components/message/MessageList.test.tsx` | Turn-to-component mapping |
| `src/frontend/components/message/ThinkingBlock.test.tsx` | Thinking block rendering |
| `src/frontend/components/message/SubAgentView.test.tsx` | Sub-agent inline display |
| `src/frontend/components/dashboard/DashboardStats.test.tsx` | Dashboard rendering, loading state, model display |
| `src/frontend/components/search/SearchModal.test.tsx` | Search modal UI |
| `src/frontend/components/project/ProjectList.test.tsx` | Project list rendering |
| `src/frontend/components/project/SessionList.test.tsx` | Session list with tool name display |
| `src/frontend/components/project/HiddenProjectList.test.tsx` | Hidden projects management |
| `src/frontend/components/session/SessionView.test.tsx` | Session view rendering |
| `src/frontend/components/session/SessionPresentation.test.tsx` | Presentation mode |
| `src/frontend/components/session/PresentationShell.test.tsx` | Presentation shell wrapper |
| `src/frontend/components/session/SubAgentPresentation.test.tsx` | Sub-agent presentation mode |
| `src/frontend/components/layout/Header.test.tsx` | Header component |
| `src/frontend/components/layout/Layout.test.tsx` | Layout component |
| `src/frontend/components/layout/Sidebar.test.tsx` | Sidebar component |
| `src/frontend/components/ui/CodeBlock.test.tsx` | Code block rendering |
| `src/frontend/components/ui/CollapsibleSection.test.tsx` | Collapsible section |
| `src/frontend/components/ui/DiffView.test.tsx` | Diff view rendering |
| `src/frontend/components/ui/ErrorBoundary.test.tsx` | Error boundary with retry |
| `src/frontend/components/ui/MarkdownRenderer.test.tsx` | Markdown rendering |

### Frontend — Hooks & Utils

| File | What it covers |
|---|---|
| `src/frontend/hooks/useFetch.test.ts` | Generic data fetching hook |
| `src/frontend/hooks/useHiddenProjects.test.ts` | `useHiddenProjects` hook: hide, unhide, localStorage persistence |
| `src/frontend/hooks/useKeyboard.test.tsx` | Keyboard event handling |
| `src/frontend/hooks/usePresentationMode.test.ts` | Step counting, navigation, turn boundaries, visibility |
| `src/frontend/hooks/useTheme.test.ts` | Theme cycling, font size, localStorage persistence |
| **Frontend — Utils** | |
| `src/frontend/utils/time.test.ts` | Relative time strings |
| `src/frontend/utils/model.test.ts` | Model name shortening (Opus/Sonnet/Haiku/GPT/Gemini) |
| `src/frontend/utils/project.test.ts` | Project path utilities |
| `src/frontend/utils/format-detector.test.ts` | Format detection utilities |
| `src/shared/content-blocks.test.ts` | Content block grouping |

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

### Plugin Tests

Plugin tests follow specific patterns depending on the data source:

**Codex CLI tests** use temporary directories with JSONL fixture files:
```ts
// Create temp dir structure matching ~/.codex/sessions/<project>/<id>.jsonl
const tmpDir = makeTmpDir();
mkdirSync(join(tmpDir, "sessions", "project-dir"), { recursive: true });
writeFileSync(join(tmpDir, "sessions", "project-dir", "session-1.jsonl"), jsonlContent);
setCodexCliDir(tmpDir);
```

**OpenCode tests** use temporary SQLite databases with fixture data:
```ts
// Create temp DB matching opencode.db schema (session, message, part tables)
const db = new Database(join(tmpDir, "opencode.db"));
db.run("CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT, ...)");
db.run("INSERT INTO session VALUES (...)");
setOpenCodeDir(tmpDir);
```

Both patterns use `afterEach` cleanup to remove temporary files and reset config.

## Adding Tests

1. Create `<module>.test.ts` or `<Component>.test.tsx` next to the source file
2. Import from `bun:test` for `test`, `expect`, `describe`, `beforeEach`
3. For components, import `render` from `@testing-library/react`
4. For parser logic, import `buildTurns` and construct `RawLine[]` fixtures
