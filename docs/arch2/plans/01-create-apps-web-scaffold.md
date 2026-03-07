# 01 Create `apps/web` Scaffold

## Why this task exists

The shared application shell needs a dedicated home before any runtime split can happen. This task creates `apps/web` as the canonical UI package without changing runtime behavior yet.

## Depends on

- No prerequisite task.

## In scope

- Create `apps/web`.
- Add Bun-oriented package metadata and TypeScript config.
- Add the initial browser entrypoint and HTML entry.
- Add `mountKloviApp(config)` as the shared app bootstrap contract, even if it initially mounts a placeholder.

## Out of scope

- Moving the existing desktop app shell into `apps/web`.
- Adding HTTP transport.
- Adding any desktop integration changes.

## Files/directories to create or change

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/src/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/bootstrap.tsx`
- root `package.json`
- root `tsconfig.json` if needed for new workspace coverage

## Implementation steps

1. Create the `apps/web` workspace package.
2. Configure it as a Bun/React browser app with `build`, `dev`, and `typecheck` scripts.
3. Add `src/index.html` as the browser HTML entry.
4. Add `src/bootstrap.tsx` exporting `mountKloviApp(config)`.
5. Add `src/main.tsx` that resolves a root container and calls `mountKloviApp(config)`.
6. Keep the initial mount intentionally minimal, such as a placeholder shell confirming the app is wired correctly.
7. Update root workspace scripts only as much as needed for the new workspace to exist cleanly.

## Acceptance criteria

- `apps/web` exists as a valid Bun workspace package.
- `mountKloviApp(config)` exists and is exported from `apps/web/src/bootstrap.tsx`.
- A browser entrypoint exists and uses the shared bootstrap.
- No desktop behavior changes yet.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
