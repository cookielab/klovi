# Effect.js Everywhere — Design Spec

**Date:** 2026-04-05
**Status:** Design approved, awaiting implementation plan
**Scope:** Full Effect adoption across all layers of the Klovi codebase

## Motivation

Klovi already uses Effect in plugins and server infrastructure (~49 files). The remaining ~244 files use plain async/await, Promises, `.catch(() => {})`, and custom React hooks. This creates:

- A bridging layer (`runPluginEffect`, `runRegistryEffect`) that exists only to translate between zones
- Silent error swallowing in UI and service code
- Manual retry/resource/concurrency logic that Effect provides natively
- Inconsistent patterns between plugin code (Effect) and the services that consume it (Promise)

This spec extends Effect to every layer: server services, desktop main process, and frontend React. The boundary functions are deleted.

## Goals

1. Single programming model across the entire codebase
2. Typed error channels from I/O through to the UI, with pattern-matched recovery actions
3. Structured concurrency and resource safety (scopes) wherever I/O happens
4. Eliminate bridging functions between Promise and Effect zones
5. Deterministic tests via `TestClock` and in-memory `FileSystem` layers

## Non-Goals

- Converting presentation-only packages (`ui-components`, `design-system`) — no I/O, no benefit
- Rewriting CSS or component visual structure
- Changing the RPC schema or HTTP protocol
- Adding caching or memoization layers (project rule: no caching)
- Migrating to a different testing framework (staying on `bun:test`)

## Approach

**Incremental, inside-out migration** in three phases, each producing a working codebase:

1. **Phase 1: Server service layer** — closest to existing Effect code
2. **Phase 2: Desktop main process** — adds `ManagedRuntime` to Electrobun/Bun host
3. **Phase 3: Frontend React** — `@effect/rx` + `@effect/rx-react` for all data flows

Testing migration is integrated within each phase, not a separate phase.

---

## Phase 1: Server Service Layer

### Target Files

| File | Current | Target |
|------|---------|--------|
| `packages/server/src/services/settings.ts` | async + `node:fs/promises` | `Effect.Effect<T, SettingsError, FileSystem>` |
| `packages/server/src/services/app-services.ts` | ~16 async RPC handlers | Split into 4 Effect service modules |
| `packages/server/src/services/stats.ts` | async aggregation | `Effect.gen` with `Effect.forEach` parallel loading |
| `packages/server/src/services/auto-discover.ts` | async `createRegistry` | `Effect.gen` yielding plugin `isDataAvailable` |
| `packages/server/src/effect/http-app.ts` | `Effect.tryPromise` bridge | Direct `yield* handler(params)` dispatch |
| `packages/server/src/effect/plugin-runtime.ts` | Boundary functions | **Deleted** |

### New Files

- `packages/server/src/services/errors.ts` — tagged domain errors using `Data.TaggedError`
- `packages/server/src/services/settings-service.ts` — extracted from `app-services.ts`
- `packages/server/src/services/sessions-service.ts` — extracted from `app-services.ts`
- `packages/server/src/services/stats-service.ts` — renamed from `stats.ts`
- `packages/server/src/services/onboarding-service.ts` — extracted from `app-services.ts`

### Domain Error Types

Tagged errors surfaced through the Effect `E` channel:

- `SettingsCorruptError` — JSON parse failure
- `SettingsNotFoundError` — file does not exist
- `SettingsWriteError` — atomic write failed
- `SessionNotFoundError` — session ID does not exist
- `ProjectNotFoundError` — project path does not exist
- `RegistryUnavailableError` — registry not yet initialized
- `PluginOperationError` — wraps underlying plugin error with operation context

### Settings I/O Pattern

The atomic write pattern (temp file → rename) becomes an `Effect.acquireRelease` scope. The temp file is guaranteed to be cleaned up on success, failure, or interruption.

### Stats Aggregation

Session loading is currently sequential. Target: `Effect.forEach(sessions, loadSession, { concurrency: "unbounded" })`. Stats accumulation via `Effect.reduce` instead of mutation.

### HTTP Dispatcher Rewiring

`http-app.ts` currently wraps handler calls in `Effect.tryPromise`. After Phase 1, handlers are Effects directly, so dispatch becomes `yield* handler(params)`. The error channel of the dispatcher narrows from `unknown` to a union of domain errors.

### Migration Order (Within Phase 1)

1. Define domain error types (`errors.ts`)
2. Convert `settings.ts` (leaf dependency)
3. Convert `stats.ts`
4. Convert `auto-discover.ts`
5. Split and convert `app-services.ts` into four service modules
6. Rewire `http-app.ts` to call Effects directly
7. Delete `plugin-runtime.ts`

The boundary functions remain until step 7 so the app runs at every step.

---

## Phase 2: Desktop Main Process

### Target Files

| File | Current | Target |
|------|---------|--------|
| `apps/desktop/src/bun/index.ts` | async handlers + `setInterval` | `ManagedRuntime` with scoped fibers |
| `apps/desktop/src/bun/updater.ts` | 705-line async state machine | Single `Effect.gen` with `Schedule` + `Stream` + scopes |
| `apps/desktop/src/bun/linux-runtime.ts` | async theme detection | `Effect` using `CommandExecutor` |

### New Files

- `apps/desktop/src/bun/rpc-handlers.ts` — RPC handler Effects, extracted from `index.ts`
- `apps/desktop/src/bun/runtime.ts` — `ManagedRuntime` construction and lifecycle
- `apps/desktop/src/bun/services.ts` — Context service tags (SettingsPathRef, UpdaterService, UpdateStateRef, RegistryRef)

### Main Process Runtime

A single `ManagedRuntime` created at startup, providing:

- `BunContext` — Bun platform layer
- `FileSystem` — from `@effect/platform-bun`
- `HttpClient` — for the updater
- `CommandExecutor` — for Linux theme detection
- `SettingsPathRef`, `UpdaterService`, `UpdateStateRef`, `RegistryRef` — app services

The runtime is disposed on app quit, interrupting all fibers cleanly.

### RPC Handler Integration

Electrobun's `defineRPC` requires Promise-returning functions. Each handler is defined as an Effect, then wired through a thin adapter: `runtime.runPromise(handler(params))`. This is the single boundary between Electrobun's callback world and the Effect runtime.

### Updater State Machine

The 700-line updater becomes an `Effect.gen` program:

- `fetchWithRetry` → `Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))))`
- Streaming download → `Stream` with progress via `Stream.tap` into a `SubscriptionRef<UpdateState>`
- Temp files (zip, extracted bundle, backup dir) → `Effect.acquireRelease` scopes guaranteeing cleanup on success, failure, or interruption
- Platform-specific apply (macOS bundle replacement, Windows task scheduler) → separate Effects selected via `Effect.if` or `Layer`
- State transitions → tagged errors: `UpdateDownloadFailed`, `UpdateDecompressionFailed`, `UpdateApplyFailed`, `UpdateNotAvailable`
- UI subscribes to `UpdateStateRef` via RPC handler that yields state snapshots

### Linux Theme Polling

`setInterval` with 5s spacing → `Effect.schedule(detectTheme, Schedule.spaced("5 seconds"))` forked onto the runtime's scope. Cleanly interrupted on app quit.

### Integration with Phase 1

The desktop main process imports Effect-based services from `@cookielab.io/klovi-server` directly. No HTTP boundary for local calls (HTTP server remains available for future web mode).

---

## Phase 3: Frontend React

### New Dependencies

- `@effect/rx` and `@effect/rx-react` added to `packages/ui/package.json`

### Target Files

| File | Current | Target |
|------|---------|--------|
| `packages/ui/src/app/hooks/useRpc.ts` | custom Promise hook | **Deleted** |
| `packages/ui/src/app/hooks/useSessionData.ts` | wraps `useRPC` | `sessionDataRx` family in `rx/` |
| `packages/ui/src/app/hooks/useTheme.ts` | Promise + callback subscription | `themeRx` backed by `Rx.subscriptionRef` |
| `packages/ui/src/lib/context.ts` | React Context for client | **Deleted** (replaced by Effect `Context`) |
| `packages/ui/src/app/App.tsx` | Promise chains, `.catch(() => {})` | `useRxValue` subscriptions |
| All 78 data-dependent components | `useRPC` hooks | `useRxValue` with Rx values |

### New Files

- `packages/ui/src/lib/runtime.ts` — `ManagedRuntime` for the UI, disposed on root unmount
- `packages/ui/src/lib/rpc-client.ts` — `RpcClient` Context service with Effect-returning methods
- `packages/ui/src/app/rx/session-rx.ts` — session data Rx values
- `packages/ui/src/app/rx/projects-rx.ts` — projects Rx values
- `packages/ui/src/app/rx/stats-rx.ts` — dashboard stats Rx values
- `packages/ui/src/app/rx/search-rx.ts` — search Rx values
- `packages/ui/src/app/rx/settings-rx.ts` — settings Rx values
- `packages/ui/src/app/rx/theme-rx.ts` — theme Rx backed by host bridge
- `packages/ui/src/app/rx/fonts-rx.ts` — font preferences Rx
- `packages/ui/src/app/components/error-display/TypedErrorDisplay.tsx` — pattern-matched error rendering

### RPC Client Abstraction

`RpcClient` becomes a Context service with Effect-returning methods. Two implementations provided as layers:

- **Electrobun bridge layer** (primary) — calls into the desktop main process
- **HTTP client layer** (browser fallback) — for web deployments

RPC errors become tagged types: `RpcTimeoutError`, `RpcDisconnectedError`, `RpcHandlerError` (carries server-side domain error).

### Rx Value Pattern

Each data resource is a `Rx.Rx<Result<A, E>>` where `Result` is a discriminated union (`initial | success | failure`). Families (functions taking params → Rx) are used for parameterized queries like `sessionDataRx({ sessionId, project })`.

Components consume Rx values via `useRxValue` and pattern-match on `Result`:

- `onInitial` → loading spinner
- `onSuccess(value)` → render content
- `onFailure(cause)` → `<TypedErrorDisplay cause={cause} />`

### Typed Error Recovery UI

`TypedErrorDisplay` pattern-matches on tagged error types and renders targeted recovery:

| Error | User-Facing Action |
|-------|--------------------|
| `RpcTimeoutError` | "Request timed out" + Retry button (`Rx.refresh`) |
| `RpcDisconnectedError` | "Connection to main process lost" + Reload |
| `SettingsCorruptError` | "Settings file is corrupt" + Reset Settings |
| `SessionNotFoundError` | "This session no longer exists" + Back link |
| `ProjectNotFoundError` | "Project no longer exists" + Refresh list |
| Unknown defect | Generic error + Report Issue link |

### Polling and Refresh

Keep-alive refreshes (search sessions every 30s) become `Rx.pollKeepAlive` with `Schedule.fixed("30 seconds")`. Manual refresh via `Rx.refresh`.

### App Root Changes

`App.tsx` wraps the tree in `<RxRuntimeProvider runtime={kloviRuntime}>`. The old `KloviClientProvider` / `KloviHostBridgeProvider` React Contexts are deleted — their services are provided as layers to the runtime.

### Unchanged Packages

- `packages/ui-components/` (45 files) — pure presentation
- `packages/design-system/` (33 files) — tokens and styles
- All CSS — no changes

---

## Testing Strategy

### Approach

Effect-native testing with Layer-based mocks. Tests stay as `bun:test` `async` functions at the outer shape; the interior is Effect-native with `Effect.runPromise` at the boundary.

### Shared Test Infrastructure

**`packages/server/src/test-support/layers.ts`** — new file:

- `TestFileSystemLayer(files)` — in-memory `FileSystem` for deterministic I/O tests
- `TestRegistryLayer(projects)` — pre-populated registry
- `TestSettingsLayer(settings)` — in-memory settings state
- `TestClockLayer` — provides `TestClock` so retry/schedule tests are deterministic

**`packages/ui/src/test-support/rx-harness.tsx`** — new file:

- `renderWithRxRuntime(ui, { runtime })` — wraps `render()` with a test `ManagedRuntime` provider
- `makeTestRuntime(layers)` — constructs runtime with mock RpcClient/HostBridge layers

**`packages/server/src/test-support/mock-rpc-client.ts`** — new file:

- Effect-based RPC mock with canned responses and call history
- Provided as `Layer.succeed(RpcClient, mockImpl)`

### Migration by Test Type

- **Service tests** — replace `tmpdir()` + filesystem side effects with `TestFileSystemLayer`
- **Hook tests** — `useRpc.test.ts` deleted; replaced by Rx value tests (subscribe, drive transitions, assert emissions)
- **Updater tests** — semver logic unchanged; state machine tests use `TestClock` for deterministic retries
- **Plugin tests** — already Effect-native, unchanged
- **Component tests** — use `renderWithRxRuntime` with mock RpcClient layer

### Global Test Setup

`/test-setup.ts`:

- Keeps happy-dom globals
- Removes global `setupMockRPC()` — tests provide layers explicitly
- Adds Effect test runtime initialization if needed

---

## Deleted Code

After all three phases:

- `packages/server/src/effect/plugin-runtime.ts` — entire file
- `runPluginEffect`, `runRegistryEffect` functions
- `packages/ui/src/app/hooks/useRpc.ts` — entire file
- `packages/ui/src/lib/context.ts` — entire file
- Global `setupMockRPC()` usage
- Most `.catch(() => {})` silent error swallowing
- `Effect.tryPromise` bridge in `http-app.ts`

## Success Criteria

- Zero uses of `Effect.runPromise` outside entrypoint boundaries (HTTP server, RPC handler, React root, runtime construction)
- Zero uses of `.catch(() => {})` in production code
- All error displays in UI pattern-match on tagged error types
- All 546 tests pass; all pass with deterministic `TestClock` (no sleep-based waits)
- `runPluginEffect` / `runRegistryEffect` / `useRPC` / `KloviClientProvider` do not exist in the codebase

## Open Questions

None at design time. Implementation plan will resolve file-by-file details.
