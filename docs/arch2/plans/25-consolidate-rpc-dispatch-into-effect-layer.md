# Consolidate RPC Dispatch Into Effect Layer

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the legacy `rpc.ts` dispatch table and have `http-app.ts` dispatch directly to `KloviServices` methods, eliminating the dual method registry maintained by hand.

**Architecture:** Currently `http-app.ts` yields `KloviServices` from the Effect context, then manually constructs an `RPCContext` struct to bridge into the plain `handleRPC()` function in `rpc.ts`. This means two representations of available RPC methods are kept in sync by hand — `KloviServicesShape` in the Effect layer and the `handlers` record in `rpc.ts`. Some methods exist in one but not the other (`getUpdateSettings`/`updateUpdateSettings` are in the service shape but absent from `rpc.ts`). Consolidating removes the bridge and makes `KloviServices` the single source of truth for available RPC methods.

**Tech Stack:** Effect, @effect/platform

**Depends on:** None (can run in parallel with other plans)

---

## In scope

- Remove `apps/server/src/rpc.ts` entirely
- Move RPC dispatch logic into `http-app.ts` (or a new `rpc-dispatch.ts` if cleaner)
- Dispatch directly from route handler to `KloviServices` methods
- Ensure all methods in `KloviServicesShape` are callable via RPC
- Preserve `RPCError` (move to appropriate location)
- Preserve JSON body parsing and error handling behavior

## Out of scope

- Changing the HTTP transport protocol (`POST /api/rpc/:method`)
- Adding new RPC methods
- Changing `KloviServicesShape` or `KloviClient` interfaces

## Files/directories to create or change

- Delete: `apps/server/src/rpc.ts`
- Modify: `apps/server/src/effect/http-app.ts` — inline or import dispatch logic
- Modify: `apps/server/src/effect/server-services.ts` — if methods need to be added to match full RPC surface
- Modify or create: `apps/server/src/rpc-error.ts` — if `RPCError` needs a new home
- Modify: any tests that import from `rpc.ts`

## Implementation steps

1. **Audit method parity.** Compare the `handlers` record in `rpc.ts` with `KloviServicesShape` in `server-services.ts`. List methods present in one but not the other. Add any missing methods to `KloviServicesShape`.

2. **Move `RPCError` to its own file** (e.g., `apps/server/src/rpc-error.ts`) or inline into `http-app.ts`.

3. **Build a dispatch map in `http-app.ts`.** Replace the `RPCContext` bridge with a direct dispatch from route params to `KloviServices` methods:
   ```ts
   const dispatch: Record<string, (services: KloviServicesShape, params: Record<string, unknown>) => Promise<unknown> | unknown> = {
     acceptRisks: () => ({ ok: true }),
     getVersion: (s) => s.getVersion(),
     getStats: (s) => s.getStats(),
     // ... all methods
   };
   ```

4. **Update the route handler** to use the dispatch map directly instead of constructing `RPCContext` and calling `handleRPC()`.

5. **Delete `apps/server/src/rpc.ts`.**

6. **Update imports** in any file that imported from `rpc.ts` (primarily `http-app.ts`).

7. **Run verification.**

## Acceptance criteria

- `apps/server/src/rpc.ts` is deleted
- All RPC methods callable before are still callable after
- Methods in `KloviServicesShape` that were missing from `rpc.ts` are now callable via RPC
- No `RPCContext` type exists anywhere
- All existing RPC tests pass without modification (same HTTP behavior)
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
