# Testing

## Test Setup

Klovi uses `bun test` as the primary test runner across the workspace.

`bunfig.toml` preloads [test-setup.ts](/Users/vrtak-cz/Workspace/Cookielab/Klovi/test-setup.ts),
which:

- creates a `happy-dom` window
- registers browser-like globals (`window`, `document`, `localStorage`, `history`, ...)
- calls `setupMockRPC()` from
  `packages/ui/src/app/test-helpers/mock-rpc.ts`

That means React/UI tests can render without repeating DOM and mock-transport
setup in every file.

## Commands

```bash
bun run check
bun run typecheck
bun test
bun run test:node-smoke
bun run stage:npm
bun run verify:packed-artifact
```

Useful targeted runs:

```bash
bun test apps/package/src
bun test apps/desktop/src
bun test packages/server/src
bun test packages/ui/src
bun test packages/plugin-core/src
bun test packages/plugin-claude-code/src
bun test packages/plugin-codex/src
bun test packages/plugin-opencode/src
```

## Test Layout

### `apps/package`

- `src/cli.test.ts`
- `src/cli-config.test.ts`
- `src/server.test.ts`
- `src/integration.test.ts`
- `src/http-app.test.ts`
- `src/static-handler.test.ts`

These validate CLI wiring, package-only HTTP composition, and the browser/npm
distribution entrypoint.

### `apps/desktop`

- `src/bun/updater.test.ts`

Desktop-specific tests are currently concentrated around updater behavior and
desktop packaging/runtime wiring.

### `packages/server`

- `src/server.test.ts`
- `src/integration.test.ts`
- `src/rpc.test.ts`
- `src/effect/server-services.test.ts`
- `src/services/*.test.ts`

These cover HTTP routing, Effect service composition, settings handlers, plugin
registry refresh, and backend behavior.

### `packages/ui`

- `src/lib/*.test.ts`
- `src/app/*.test.tsx`
- `src/app/components/**/*.test.tsx`
- `src/app/hooks/**/*.test.ts`

These cover the shared app shell, onboarding, settings, layout, host capability
gating, and view-state behavior.

### Plugin packages

- `packages/plugin-core/src/*.test.ts`
- `packages/plugin-claude-code/src/*.test.ts`
- `packages/plugin-codex/src/*.test.ts`
- `packages/plugin-opencode/src/*.test.ts`

These cover plugin contracts, discovery, parsing, and runtime portability.

### Reusable UI packages

- `packages/ui-components/src/**/*.test.ts*`
- `packages/design-system/src/**/*.test.ts*`

These validate reusable rendering, presentation helpers, formatting utilities,
and design-system hooks/components independently of the app shell.

## Node Runtime Smoke Coverage

`bun run test:node-smoke` executes `scripts/plugin-runtime-node-smoke.ts` to
validate the plugin layer under Node.

It verifies that:

- plugin packages import cleanly under Node
- a registry can be built with the Node runtime
- file-backed plugin flows still work
- the OpenCode plugin handles missing SQLite data correctly

This is a focused compatibility check, not a duplicate of the full Bun test
suite.

## Packed Artifact Verification

`bun run verify:packed-artifact` exercises the staged npm artifact end-to-end:

1. pack `apps/package/.stage/npm`
2. install it into a clean temp directory
3. run the installed CLI under Node
4. run the installed CLI under Bun
5. verify the public `@cookielab.io/klovi/server` import

The verifier now uses an isolated `KLOVI_SETTINGS_PATH` so it does not depend on
the developer's real local Klovi settings.

## Common Patterns

### Mocking the transport layer

`setupMockRPC()` in `packages/ui/src/app/test-helpers/mock-rpc.ts` provides
default no-op implementations for `KloviClient` and `KloviHostBridge`. Tests
override only the methods they care about.

### Temp fixtures for discovery/parser tests

Plugin tests typically create temp directories or temp SQLite data and point the
plugin configuration at those fixtures. Keep the fixtures local to the test and
clean them up in `afterEach`.

### Prefer colocated tests

New tests should live next to the module they cover:

- `*.test.ts`
- `*.test.tsx`

Use `bun:test` and `@testing-library/react` where applicable.
