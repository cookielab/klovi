# 12 Expand Test And Smoke Coverage

## Why this task exists

The architecture split changes runtime wiring, packaging, and host capability behavior. The test suite must explicitly cover those new seams.

## Depends on

- [05-add-http-rpc-surface.md](./05-add-http-rpc-surface.md)
- [09-start-embedded-server-from-electrobun.md](./09-start-embedded-server-from-electrobun.md)
- [10-add-web-mode-capability-gating.md](./10-add-web-mode-capability-gating.md)
- [11-add-three-app-dev-build-workflows.md](./11-add-three-app-dev-build-workflows.md)

## In scope

- Add tests for browser mode, desktop mode, and packaging-facing behavior.
- Add smoke coverage for the published server package behavior.

## Out of scope

- Broad refactors unrelated to the split.

## Files/directories to create or change

- `apps/server/src/**/*.test.ts`
- `apps/web/src/**/*.test.tsx`
- `apps/desktop/src/**/*.test.ts`
- smoke-test scripts under `apps/server/scripts/**` or root `scripts/**`
- `docs/testing.md` if the main test guide needs an update after implementation

## Implementation steps

1. Add server tests for `POST /api/rpc/:method`.
2. Add tests for browser-mode capability gating.
3. Add desktop integration tests covering the host bridge path.
4. Add a smoke test for the CLI/package flow expected by `bunx @cookielab.io/klovi@latest`.
5. Confirm the shared app still renders correctly in desktop mode through Electrobun.

## Acceptance criteria

- Browser mode has explicit test coverage.
- Desktop mode has explicit test coverage for the embedded server and host bridge path.
- Published server behavior has at least one smoke test path.
- The test plan explicitly protects the key split-runtime seams introduced by Arch2.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
