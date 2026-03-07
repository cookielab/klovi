# 04 Extract Server Application Services

## Why this task exists

Klovi's app services currently live inside desktop RPC handlers. Browser mode needs those services without depending on Electrobun. This task extracts the non-native logic into `apps/server`.

## Depends on

- [01-create-apps-web-scaffold.md](./01-create-apps-web-scaffold.md)

## In scope

- Create `apps/server`.
- Move non-native application services from desktop into server-owned modules.
- Keep desktop-only concerns out of the extracted service layer.

## Out of scope

- Adding HTTP endpoints.
- Publishing the server package.

## Files/directories to create or change

- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/server/src/services/**`
- `apps/server/src/settings.ts`
- `apps/server/src/catalog.ts` if the built-in plugin catalog moves
- `apps/server/src/stats.ts` if stats aggregation moves
- `apps/desktop/src/bun/rpc-handlers.ts`
- `apps/desktop/src/bun/settings.ts`
- `apps/desktop/src/plugins/**`
- `apps/desktop/src/parser/stats.ts`

## Implementation steps

1. Create `apps/server` as a Bun workspace package.
2. Identify logic in desktop RPC handlers that is application logic rather than desktop-native integration.
3. Move settings persistence, registry construction, stats scanning, search, project/session loading, and plugin settings handling into `apps/server/src/services`.
4. Keep native-only operations such as updater handling, file dialogs, and menu wiring out of the extracted layer.
5. Refactor desktop RPC handlers to call the extracted services rather than owning the logic directly.
6. Preserve current behavior and method names so the later HTTP layer can mirror the existing app contract.

## Acceptance criteria

- `apps/server` contains the app service layer.
- Desktop RPC handlers delegate to server-owned service modules for non-native work.
- No desktop-native behavior is moved into the server service layer.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
