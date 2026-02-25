# Testing

## Setup

Klovi uses `bun test` as the single test runner across the monorepo.

`bunfig.toml` preloads `test-setup.ts`:

```toml
[test]
preload = ["./test-setup.ts"]
```

`test-setup.ts`:

- Boots happy-dom (`GlobalWindow`)
- Registers browser-like globals (`window`, `document`, `localStorage`, `history`, ...)
- Calls `setupMockRPC()` from `src/frontend/test-helpers/mock-rpc.ts`

This means frontend tests can render immediately without repeating DOM/RPC bootstrap code.

## Running Tests

```bash
bun test                                  # Entire monorepo
bun test src                              # Desktop app shell tests
bun test packages/klovi-plugin-core/src   # Core plugin package tests
bun test packages/klovi-plugin-claude-code/src
bun test packages/klovi-plugin-codex/src
bun test packages/klovi-plugin-opencode/src
bun test packages/klovi-ui/src
bun test packages/klovi-design-system/src
bun test --watch
```

## Test Layout

### App Shell Tests (`src/`)

| Area | Representative files |
|---|---|
| Main process RPC/settings | `src/bun/rpc-handlers.test.ts`, `src/bun/settings.test.ts`, `src/bun/settings-handlers.test.ts` |
| Plugin registry wiring | `src/plugins/registry.test.ts`, `src/plugins/auto-discover.test.ts` |
| Stats aggregation | `src/parser/stats.test.ts` |
| Shared helpers | `src/shared/content-blocks.test.ts`, `src/shared/iso-time.test.ts` |
| App flow/routing/plugin wiring | `src/frontend/AppGate.test.tsx`, `src/frontend/view-state.test.ts`, `src/frontend/plugin-registry.test.ts` |
| Frontend wrappers/layout | `src/frontend/components/layout/*.test.tsx`, `src/frontend/components/session/*.test.tsx`, `src/frontend/components/settings/SettingsView.test.tsx`, `src/frontend/components/ui/*.test.tsx` |
| Frontend hooks/utils | `src/frontend/hooks/*.test.ts*`, `src/frontend/utils/*.test.ts` |

### Workspace Package Tests (`packages/`)

| Package | Representative files |
|---|---|
| `@cookielab.io/klovi-plugin-core` | `packages/klovi-plugin-core/src/plugin-registry.test.ts`, `ids.test.ts`, `session-id.test.ts`, `iso-time.test.ts` |
| `@cookielab.io/klovi-plugin-claude-code` | `packages/klovi-plugin-claude-code/src/discovery.test.ts`, `parser.test.ts`, `subagent.test.ts`, `command-message.test.ts`, `shared/*.test.ts` |
| `@cookielab.io/klovi-plugin-codex` | `packages/klovi-plugin-codex/src/discovery.test.ts`, `parser.test.ts`, `session-index.test.ts`, `extractors.test.ts`, `shared/*.test.ts` |
| `@cookielab.io/klovi-plugin-opencode` | `packages/klovi-plugin-opencode/src/discovery.test.ts`, `parser.test.ts`, `db.test.ts`, `shared/json-utils.test.ts` |
| `@cookielab.io/klovi-ui` | `packages/klovi-ui/src/presentation/*.test.ts*`, `search/SearchModal.test.tsx`, `sessions/ProjectList.test.tsx`, `tools/ToolCallDefaults.test.ts`, `utilities/*.test.ts`, `types/index.test.ts` |
| `@cookielab.io/klovi-design-system` | `packages/klovi-design-system/src/components/components.test.tsx`, `hooks/useTheme.test.ts` |

## Common Patterns

### 1. Mock RPC in frontend tests

`setupMockRPC()` provides default no-op handlers for all RPC methods. Tests override only what they need.

```ts
import { setupMockRPC } from "../test-helpers/mock-rpc.ts";

setupMockRPC({
  getProjects: () => Promise.resolve({ projects: [] }),
});
```

### 2. Temp directories for discovery tests

Plugin discovery tests usually create temporary directory trees and fixture JSONL files, then point plugin config to the temp location.

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setCodexCliDir } from "./config.ts";

const root = join(tmpdir(), "klovi-test");
mkdirSync(join(root, "sessions", "openai", "2025-01-15"), { recursive: true });
writeFileSync(join(root, "sessions", "openai", "2025-01-15", "abc.jsonl"), "{...}\n{...}");
setCodexCliDir(root);
```

### 3. Temp SQLite for OpenCode tests

OpenCode tests build temporary SQLite DB fixtures matching expected tables (`session`, `message`, `part`) before executing discovery/parser logic.

### 4. Package component tests

`@cookielab.io/klovi-ui` and `@cookielab.io/klovi-design-system` tests validate reusable component behavior independent of app-shell wrappers.

## Writing New Tests

1. Place test files near the module (`*.test.ts` / `*.test.tsx`).
2. Use `bun:test` (`describe`, `test`, `expect`, lifecycle hooks).
3. For React tests, use `@testing-library/react`.
4. For app-shell frontend tests, prefer overriding RPC via `setupMockRPC()`.
5. For plugin discovery/parser tests, use temp fixtures and clean them up in `afterEach`.
