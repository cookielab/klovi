# 11 Add Three-App Dev And Build Workflows

## Why this task exists

The repo needs explicit workflows for the new three-app layout so development and CI stay predictable.

## Depends on

- [07-publish-apps-server-as-@cookielab.io-klovi.md](./07-publish-apps-server-as-@cookielab.io-klovi.md)
- [09-start-embedded-server-from-electrobun.md](./09-start-embedded-server-from-electrobun.md)

## In scope

- Add root scripts for `dev`, `dev:web`, `dev:server`, `dev:desktop`, and `build`.
- Add app-level scripts needed for those workflows.
- Keep the workflow Bun-native.

## Out of scope

- Additional deployment automation beyond what is required for local dev and build.
- New package manager or task runner adoption.

## Files/directories to create or change

- root `package.json`
- root `scripts/**` if orchestration scripts are needed
- `apps/server/package.json`
- `apps/web/package.json`
- `apps/desktop/package.json`

## Implementation steps

1. Define root scripts for the three-app layout.
2. Define app-level `dev`, `build`, and `typecheck` scripts where missing.
3. Keep the workflows Bun-native and workspace-aware.
4. Ensure desktop development still starts through Electrobun.
5. Ensure browser-mode development has a clear path to run the shared app and the server together.

## Acceptance criteria

- The repo has documented root scripts for the three-app layout.
- Each app exposes the scripts needed by the root workflow.
- The workflows do not require introducing a new package under `packages/`.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
