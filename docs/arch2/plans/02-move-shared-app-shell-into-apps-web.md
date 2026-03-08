# 02 Move Shared App Shell Into `apps/web`

## Why this task exists

Klovi's current React shell lives under `apps/desktop/src/frontend`. That prevents a browser-served variant from reusing the same app shell. This task makes `apps/web` the source of truth for the UI.

## Depends on

- [01-create-apps-web-scaffold.md](./01-create-apps-web-scaffold.md)

## In scope

- Move the current shared app shell from desktop into `apps/web`.
- Keep the current UI behavior intact.
- Make desktop consume the shared app shell from `apps/web`.

## Out of scope

- Replacing desktop RPC assumptions with transport-neutral abstractions.
- Adding browser mode or server mode behavior.

## Files/directories to create or change

- `apps/web/src/app/**`
- `apps/web/src/bootstrap.tsx`
- `apps/desktop/src/views/main/index.ts`
- `apps/desktop/src/frontend/**` either removed or reduced to wrappers that delegate to `apps/web`
- any style files currently under `apps/desktop/src/frontend/**`

## Implementation steps

1. Move the app shell code from `apps/desktop/src/frontend` into `apps/web/src/app`.
2. Preserve current structure where practical so test and component names remain recognizable.
3. Update imports so the shared app shell still uses:
   - `packages/ui-components`
   - `packages/design-system`
   - existing plugin frontend packages
4. Make `apps/web/src/bootstrap.tsx` mount the moved `AppGate` or equivalent shared root.
5. Update `apps/desktop/src/views/main/index.ts` so it imports and mounts the shared app from `apps/web`.
6. Do not change runtime assumptions yet beyond what is strictly necessary to compile.

## Acceptance criteria

- `apps/web` owns the app shell source.
- Desktop renders the shared app from `apps/web`.
- UI behavior is functionally unchanged from the pre-split desktop app.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
