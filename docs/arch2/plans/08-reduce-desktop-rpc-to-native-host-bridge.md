# 08 Reduce Desktop RPC To Native Host Bridge

## Why this task exists

Once server-backed methods are available through `KloviClient`, Electrobun RPC should stop acting as the app's main transport and become a narrow native bridge only.

## Depends on

- [03-introduce-client-and-host-bridge-abstractions.md](./03-introduce-client-and-host-bridge-abstractions.md)
- [05-add-http-rpc-surface.md](./05-add-http-rpc-surface.md)

## In scope

- Reduce Electrobun RPC to desktop-native methods and event delivery only.
- Remove server-backed data methods from the desktop RPC contract.

## Out of scope

- Starting the embedded server.
- Root dev/build workflow changes.

## Files/directories to create or change

- `apps/desktop/src/shared/rpc-types.ts`
- `apps/desktop/src/bun/index.ts`
- `apps/desktop/src/bun/rpc-handlers.ts`
- desktop-side host bridge bootstrap files
- `apps/web` desktop host bridge adapter if it exists there

## Implementation steps

1. Remove server-backed methods from the Electrobun RPC contract.
2. Keep only desktop-native methods:
   - `browseDirectory`
   - `getUpdateSettings`
   - `updateUpdateSettings`
   - `checkForUpdate`
   - `applyUpdate`
   - `openExternal`
3. Keep desktop-side pushed messages for:
   - menu actions
   - update status
   - manual update results
4. Ensure the shared app consumes those through `KloviHostBridge`, not through desktop-specific globals.

## Acceptance criteria

- Electrobun RPC no longer carries server-backed data methods.
- Desktop RPC acts only as the native host bridge.
- The shared app shell still has access to updater, directory picker, and menu-action behavior through `KloviHostBridge`.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
