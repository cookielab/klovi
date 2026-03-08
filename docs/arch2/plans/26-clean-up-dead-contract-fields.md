# Clean Up Dead Contract Fields

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve two inert contract fields — `mode` in `startKloviServer()` and `initialUrl` in `mountKloviApp()` — by either wiring them up or removing them, so the public contracts match actual behavior.

**Tech Stack:** TypeScript, Effect, React

**Depends on:** None (can run in parallel with other plans)

---

## In scope

- `mode` field in `StartKloviServerOptions` (`apps/server/src/server.ts`) — accepted but never branched on
- `initialUrl` field in `MountKloviAppConfig` (`apps/web/src/bootstrap.tsx`) — accepted but never consumed
- Decision and implementation for each: wire up or remove

## Out of scope

- Adding new contract fields
- Changing the `KloviClient` or `KloviHostBridge` interfaces
- Behavioral changes beyond what the fields imply

## Implementation steps

### `mode` in `startKloviServer()`

The `mode` field accepts `"standalone" | "embedded"`. Desktop passes `mode: "embedded"`, package passes nothing (defaults would be `"standalone"`). Currently it has no effect.

**Decision:** Evaluate whether `mode` should influence any behavior (e.g., logging verbosity, error reporting, process exit behavior). If no concrete use case exists, remove the field from the interface. Desktop and package callers can be differentiated by their own composition logic, not by a server flag.

1. Search for all call sites of `startKloviServer()` and all reads of `mode` in the codebase.
2. If `mode` is unused everywhere: remove it from `StartKloviServerOptions`, remove it from call sites, update tests.
3. If a use case is found: implement the branching, document the behavior.

### `initialUrl` in `mountKloviApp()`

The `initialUrl` field is in the config shape but the `mountKloviApp()` implementation does not pass it to the router or any component.

**Decision:** Evaluate whether `initialUrl` should set the initial route when the app mounts (useful for desktop deep links or CLI `--url` args). If no concrete use case exists now, remove it.

1. Search for all call sites of `mountKloviApp()` and all reads of `initialUrl`.
2. If unused everywhere: remove it from `MountKloviAppConfig`, update call sites and tests.
3. If a use case exists: wire it into the React router as the initial location.

## Acceptance criteria

- Each field is either fully wired (with behavior and tests) or fully removed (from types, call sites, and tests)
- No inert fields remain in the public contracts
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
