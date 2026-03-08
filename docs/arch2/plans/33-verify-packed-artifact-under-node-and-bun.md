# 33 Verify Packed Artifact Under Node And Bun

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the real packaged npm artifact for `@cookielab.io/klovi` under both Node and Bun instead of relying on workspace-only build confidence.

**Architecture:** Source-tree integration tests are necessary but not sufficient. The verification path for npm distribution must exercise the same tarball shape users install from npm: the staged artifact from Plan 32, packed into a tarball, installed into a clean temporary directory, and executed there.

**Depends on:** Plans 31 and 32

---

## In scope

- Automated packed-artifact smoke testing
- Node runtime verification
- Bun runtime verification
- CLI, HTTP, SPA, and RPC verification against the packed artifact
- Failure-path checks relevant to package consumers

## Out of scope

- Desktop release verification
- Publishing to npm registry
- Browser UI end-to-end testing through a full browser automation stack

## Files/directories to create or change

- Package verification scripts
- CI workflow entries if needed for automated execution
- Test helpers for packing, installing, launching, and probing the artifact

## Implementation steps

1. **Build the staged publish artifact.**
   - Run the staging flow from Plan 32.

2. **Pack the staged artifact.**
   - Create a tarball from `apps/package/.stage/npm` using `npm pack` or `bun pm pack`.
   - The tarball produced here is the source of truth for consumer verification.

3. **Install into a clean temp directory.**
   - Create a fresh temporary directory outside the monorepo.
   - Install the tarball there using npm or Bun package installation commands.
   - Do not rely on workspace links or parent `node_modules`.

4. **Run Node verification against the installed artifact.**
   - Launch the packaged CLI with `node`.
   - Verify:
     - server starts successfully
     - bind address is localhost by default
     - `GET /` serves the app
     - deep links return SPA fallback
     - `/api/rpc/getVersion` succeeds
     - unknown RPC method returns `404`
     - empty RPC method returns `400`
     - `@cookielab.io/klovi/server` import works

5. **Run Bun verification against the installed artifact.**
   - Launch the same installed artifact with `bun`.
   - Verify the same HTTP and RPC behaviors as the Node path.

6. **Verify environment overrides.**
   - Validate documented env vars:
     - `KLOVI_HOST`
     - `KLOVI_PORT`
     - `KLOVI_STATIC_DIR`, if it remains part of the documented contract

7. **Verify failure and shutdown behavior.**
   - Start the server with an occupied port and assert a clear startup failure.
   - Stop the started process and verify it exits cleanly without hanging.

## Acceptance criteria

- Packed-artifact smoke path exists in automation
- Node and Bun both work from the same packaged output users install
- Tarball install works outside the monorepo
- HTTP serving, SPA fallback, and RPC checks pass from the packed artifact
- Public server export works from the packed artifact
- Port conflict and graceful shutdown are verified

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- Run the packed-artifact smoke path locally
- Ensure the same smoke path is runnable in CI
