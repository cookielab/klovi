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
- Calls `setupMockRPC()` from `apps/desktop/src/frontend/test-helpers/mock-rpc.ts`

This means frontend tests can render immediately without repeating DOM/RPC bootstrap code.

## Running Tests

```bash
bun test                                  # Entire monorepo
bun test apps/desktop/src                 # Desktop app shell tests
bun test packages/plugin-core/src   # Core plugin package tests
bun test packages/plugin-claude-code/src
bun test packages/plugin-codex/src
bun test packages/plugin-opencode/src
bun test packages/ui-components/src
bun test packages/design-system/src
bun test --watch
```

## Dual-Runtime Coverage

Bun is the default development and test runtime. The plugin layer also supports
Node.js via `@effect/platform-node` providers. CI runs a dedicated Node smoke
test to catch accidental Bun-only coupling in plugin code.

```bash
bun run test:node-smoke   # Node plugin runtime smoke (uses npx tsx)
```

The smoke test (`scripts/plugin-runtime-node-smoke.ts`) verifies:

- All plugin packages import cleanly under Node
- A `PluginRegistry` can be built with `NodePluginLayer`
- File-backed plugins (Claude Code) can discover, list, and load sessions
- The OpenCode SQLite adapter initializes without errors

To add new runtime smoke coverage, add assertions to
`scripts/plugin-runtime-node-smoke.ts`. Keep the full test suite in `bun test`;
the Node smoke path is a targeted compatibility check, not a mirror of the
entire suite.

## Test Layout

### App Shell Tests (`apps/desktop/src/`)

| Area | Representative files |
|---|---|
| Main process RPC/settings | `apps/desktop/src/bun/rpc-handlers.test.ts`, `apps/desktop/src/bun/settings.test.ts`, `apps/desktop/src/bun/settings-handlers.test.ts` |
| Plugin registry wiring | `apps/desktop/src/plugins/registry.test.ts`, `apps/desktop/src/plugins/auto-discover.test.ts` |
| Stats aggregation | `apps/desktop/src/parser/stats.test.ts` |
| Shared helpers | `apps/desktop/src/shared/content-blocks.test.ts`, `apps/desktop/src/shared/iso-time.test.ts` |
| App flow/routing/plugin wiring | `apps/desktop/src/frontend/AppGate.test.tsx`, `apps/desktop/src/frontend/view-state.test.ts`, `apps/desktop/src/frontend/plugin-registry.test.ts` |
| Frontend wrappers/layout | `apps/desktop/src/frontend/components/layout/*.test.tsx`, `apps/desktop/src/frontend/components/session/*.test.tsx`, `apps/desktop/src/frontend/components/settings/SettingsView.test.tsx`, `apps/desktop/src/frontend/components/ui/*.test.tsx` |
| Frontend hooks/utils | `apps/desktop/src/frontend/hooks/*.test.ts*`, `apps/desktop/src/frontend/utils/*.test.ts` |

### Workspace Package Tests (`packages/`)

| Package | Representative files |
|---|---|
| `@cookielab.io/klovi-plugin-core` | `packages/plugin-core/src/plugin-registry.test.ts`, `ids.test.ts`, `session-id.test.ts`, `iso-time.test.ts` |
| `@cookielab.io/klovi-plugin-claude-code` | `packages/plugin-claude-code/src/discovery.test.ts`, `parser.test.ts`, `subagent.test.ts`, `command-message.test.ts`, `shared/*.test.ts` |
| `@cookielab.io/klovi-plugin-codex` | `packages/plugin-codex/src/discovery.test.ts`, `parser.test.ts`, `session-index.test.ts`, `extractors.test.ts`, `shared/*.test.ts` |
| `@cookielab.io/klovi-plugin-opencode` | `packages/plugin-opencode/src/discovery.test.ts`, `parser.test.ts`, `db.test.ts`, `shared/json-utils.test.ts` |
| `@cookielab.io/klovi-ui-components` | `packages/ui-components/src/presentation/*.test.ts*`, `search/SearchModal.test.tsx`, `sessions/ProjectList.test.tsx`, `tools/ToolCallDefaults.test.ts`, `utilities/*.test.ts`, `types/index.test.ts` |
| `@cookielab.io/klovi-design-system` | `packages/design-system/src/components/components.test.tsx`, `hooks/useTheme.test.ts` |

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
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setCodexCliDir } from "./config.ts";

const root = join(tmpdir(), "klovi-test");
await mkdir(join(root, "sessions", "openai", "2025-01-15"), { recursive: true });
await Bun.write(join(root, "sessions", "openai", "2025-01-15", "abc.jsonl"), "{...}\n{...}");
setCodexCliDir(root);
```

### 3. Temp SQLite for OpenCode tests

OpenCode tests build temporary SQLite DB fixtures matching expected tables (`session`, `message`, `part`) before executing discovery/parser logic.

### 4. Package component tests

`@cookielab.io/klovi-ui-components` and `@cookielab.io/klovi-design-system` tests validate reusable component behavior independent of app-shell wrappers.

## Writing New Tests

1. Place test files near the module (`*.test.ts` / `*.test.tsx`).
2. Use `bun:test` (`describe`, `test`, `expect`, lifecycle hooks).
3. For React tests, use `@testing-library/react`.
4. For app-shell frontend tests, prefer overriding RPC via `setupMockRPC()`.
5. For plugin discovery/parser tests, use temp fixtures and clean them up in `afterEach`.
