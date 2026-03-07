# 10 Add Web Mode Capability Gating

## Why this task exists

Browser mode cannot support every native desktop affordance. This task makes the shared UI explicitly gate those features using `KloviHostCapabilities`.

## Depends on

- [03-introduce-client-and-host-bridge-abstractions.md](./03-introduce-client-and-host-bridge-abstractions.md)
- [08-reduce-desktop-rpc-to-native-host-bridge.md](./08-reduce-desktop-rpc-to-native-host-bridge.md)

## In scope

- Hide or disable updater UI in browser mode.
- Hide or disable directory-browse affordances in browser mode.
- Preserve browser-safe behavior for external links.

## Out of scope

- Changing server behavior.
- Root workflow changes.

## Files/directories to create or change

- `apps/web/src/app/components/settings/**`
- `apps/web/src/app/components/ui/**`
- `apps/web/src/app/components/UpdateNotification*`
- any shared app shell files that branch on host capabilities

## Implementation steps

1. Read host capabilities from `KloviHostBridge`.
2. Hide the Updates section when `updater` is false.
3. Hide or disable browse-directory buttons when `browseDirectory` is false.
4. Keep editable text path fields available where that remains valid.
5. Keep `openExternal` working through browser fallback behavior when desktop integration is unavailable.

## Acceptance criteria

- Updates UI is unavailable in browser mode.
- Directory browse actions are unavailable in browser mode.
- Shared UI does not rely on desktop-only globals to decide this behavior.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
