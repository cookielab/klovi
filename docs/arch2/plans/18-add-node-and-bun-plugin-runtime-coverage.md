# 18 Add Node And Bun Plugin Runtime Coverage

## Why this task exists

Tasks 14 through 17 only pay off if the repo proves the plugin layer still works under Bun and is now executable under Node. Today the automated workflow validates Bun behavior only. That is necessary, but it is not sufficient for a dual-runtime plugin architecture.

This task adds the smallest useful verification matrix for the migrated plugin layer while keeping Bun as the default development workflow.

## Depends on

- [16-migrate-claude-code-and-codex-plugins-to-effect-platform.md](./16-migrate-claude-code-and-codex-plugins-to-effect-platform.md)
- [17-migrate-opencode-plugin-to-effect-sqlite-adapter.md](./17-migrate-opencode-plugin-to-effect-sqlite-adapter.md)

## In scope

- Add dedicated smoke or contract tests for Node runtime execution of the plugin layer.
- Keep `bun run check`, `bun run typecheck`, and `bun test` as the mandatory default verification path.
- Update CI and docs so the dual-runtime expectation is explicit.

## Out of scope

- Replacing `bun test` as the primary test runner.
- Building a full duplicated Node test suite for every package.
- Migrating the desktop app to Node.
- Adding caches, background daemons, or long-lived test fixtures.

## Files/directories to create or change

- `package.json`
- `.github/workflows/ci.yml`
- `docs/testing.md`
- `apps/server/package.json` if runtime smoke scripts live there
- `scripts/**` for smoke harnesses such as:
  - `scripts/plugin-runtime-smoke.ts`
  - `scripts/plugin-runtime-node-smoke.mjs`
- any focused fixture tests under:
  - `packages/klovi-plugin-core/src/**/*.test.ts`
  - `packages/klovi-plugin-claude-code/src/**/*.test.ts`
  - `packages/klovi-plugin-codex/src/**/*.test.ts`
  - `packages/klovi-plugin-opencode/src/**/*.test.ts`

## Implementation steps

1. Keep the existing Bun verification path unchanged.
   Every task in this repo must still pass:
   - `bun run check`
   - `bun run typecheck`
   - `bun test`

2. Add one explicit Node-side smoke path for the migrated plugin layer.
   The smoke path should prove:
   - plugin packages can be imported under Node
   - a minimal registry build can run with Node runtime providers
   - at least one file-backed plugin and the OpenCode adapter can execute representative calls

3. Prefer contract-style smoke tests over duplicating the entire Bun suite.
   The goal is to catch runtime-coupling regressions, not to mirror every test twice.

4. Wire the new smoke path into CI.
   Minimum expectation:
   - Bun checks remain required on every run
   - Node plugin-runtime smoke coverage runs in CI and fails the build on regression

5. Update `docs/testing.md` to explain:
   - Bun remains the default local workflow
   - Node coverage is a targeted plugin-runtime compatibility check
   - where to add future runtime smoke tests

## Acceptance criteria

- The repository still uses Bun as the default dev/test workflow.
- CI includes at least one explicit Node runtime smoke path for the migrated plugin layer.
- The dual-runtime expectation is documented for future contributors.
- The migration is protected against accidental reintroduction of Bun-only plugin code.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
