# 35 Align Public Server Export With Vision

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the public npm server export with the Arch2 vision so `@cookielab.io/klovi/server` exposes `startKloviServer(options)` as the canonical public contract, while keeping `apps/package`-specific HTTP/static composition internal.

**Architecture:** The current implementation successfully stages and verifies a packed npm artifact, but the public package export still exposes `startKloviPackageServer` instead of the `startKloviServer(options)` contract described in `docs/arch2/VISION.md`. The fix is not to collapse `apps/package` into `packages/server`; it is to preserve the package split while making the public subpath re-export the correct server API and moving duplicated bootstrap logic into a shared internal helper under `packages/server`.

**Depends on:** None

---

## In scope

- Make `startKloviServer(options)` the canonical public export of `@cookielab.io/klovi/server`
- Keep CLI-specific static serving and browser-launch composition internal to `apps/package`
- Remove duplicated runtime/bootstrap/server-launch wiring between `packages/server` and `apps/package`
- Update packed-artifact verification and package tests to assert the public import name described by the vision
- Preserve the existing staged npm artifact shape and runtime behavior

## Out of scope

- Reworking the staged artifact pipeline itself
- Rewriting the desktop app to consume `apps/package`
- Changing the HTTP RPC contract
- Changing the public CLI name `klovi`
- Updating documentation beyond the minimal contract references needed to keep tests and code coherent

## Files/directories to create or change

- `apps/package/src/server.ts`
- `apps/package/src/cli.ts`
- `packages/server/src/server.ts`
- `packages/server/src/effect/` with a new shared bootstrap helper
- `apps/package/src/cli.test.ts`
- `apps/package/src/server.test.ts`
- `apps/package/src/integration.test.ts`
- `scripts/verify-packed-artifact.ts`
- Any small package-level export smoke tests required to assert the new public symbol

## Implementation steps

1. **Define the public contract decision.**
   - Treat `@cookielab.io/klovi/server` as a thin public subpath that exposes `startKloviServer(options)`.
   - Treat `startKloviPackageServer` as internal-only package composition logic after this task.
   - Do not leave both names as public long-term aliases unless they are explicitly required for compatibility during migration and tested as such.

2. **Extract shared bootstrap logic into `packages/server`.**
   - Create a new helper under `packages/server/src/effect/` that owns the common runtime-detection, layer assembly, address capture, failure propagation, and shutdown wiring currently duplicated between `packages/server/src/server.ts` and `apps/package/src/server.ts`.
   - Keep the helper internal to `packages/server`; it is not a new public npm surface.
   - The helper must accept the serve layer to run, so `packages/server` can use the RPC-only serve layer while `apps/package` can still compose RPC plus static file serving.

3. **Refactor `packages/server/src/server.ts` to use the shared helper.**
   - Preserve the existing `startKloviServer(options)` API shape and behavior.
   - Preserve dual-runtime support (`auto`, `bun`, `node`).
   - Preserve the `{ url, stop() }` return contract.

4. **Refactor `apps/package` composition without exposing the wrong name publicly.**
   - Move or rename the current package-composition implementation so the CLI can continue to start the combined RPC + static server.
   - Keep `apps/package/src/cli.ts` pointed at that internal composition function.
   - Make `apps/package/src/server.ts` the public bridge that re-exports `startKloviServer` from `@cookielab.io/klovi-server/server`.

5. **Update tests and packed-artifact verification.**
   - Update package tests to verify the public subpath exports `startKloviServer`.
   - Update `scripts/verify-packed-artifact.ts` so its import smoke test uses `startKloviServer` from `@cookielab.io/klovi/server`.
   - Keep the existing Node and Bun packed-artifact runtime verification in place.

6. **Check for compatibility regressions.**
   - Ensure the CLI still serves static assets, supports SPA fallback, and launches through the combined package server path.
   - Ensure the public subpath still works from the staged tarball after the refactor.

## Acceptance criteria

- `@cookielab.io/klovi/server` exposes `startKloviServer(options)` as the canonical public named export
- `startKloviPackageServer` is no longer the intended public npm contract
- `apps/package` still owns CLI-specific HTTP/static composition and browser launch
- Shared server-launch/bootstrap logic is factored into `packages/server/src/effect/` rather than duplicated
- Packed-artifact verification proves the public import name is `startKloviServer`
- The refactor does not change the existing CLI/runtime behavior for Node or Bun consumers

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run stage:npm`
- `bun run verify:packed-artifact`
- Inspect the staged `@cookielab.io/klovi/server` import path and confirm the packed-artifact smoke test asserts `startKloviServer`
