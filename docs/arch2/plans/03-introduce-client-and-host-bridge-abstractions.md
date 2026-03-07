# 03 Introduce Client And Host Bridge Abstractions

## Why this task exists

The shared app shell cannot remain coupled to Electrobun RPC and window event assumptions if it needs to run in both desktop and browser mode. This task introduces the stable runtime boundaries the rest of the initiative depends on.

## Depends on

- [02-move-shared-app-shell-into-apps-web.md](./02-move-shared-app-shell-into-apps-web.md)

## In scope

- Introduce `KloviClient`.
- Introduce `KloviHostBridge`.
- Introduce `KloviHostCapabilities`.
- Replace direct frontend calls to desktop-specific RPC globals with these abstractions.

## Out of scope

- Implementing the HTTP server.
- Reducing desktop RPC surface.

## Files/directories to create or change

- `apps/web/src/lib/client.ts`
- `apps/web/src/lib/host-bridge.ts`
- `apps/web/src/lib/browser-host-bridge.ts`
- `apps/web/src/bootstrap.tsx`
- shared app files currently calling `getRPC()` directly
- shared app files currently listening to `window` custom events directly

## Implementation steps

1. Define `KloviClient` for server-backed methods only.
2. Define `KloviHostCapabilities` with these flags:
   - `desktop`
   - `browseDirectory`
   - `updater`
   - `menuActions`
3. Define `KloviHostBridge` for native-only methods and event subscriptions.
4. Update the shared app shell to receive `client` and `hostBridge` from `mountKloviApp(config)`.
5. Replace direct `getRPC()` usage inside the shared app shell with the injected `KloviClient` and `KloviHostBridge`.
6. Add a browser host bridge implementation that exposes capability flags and safe no-op or browser-native fallbacks.

## Acceptance criteria

- The shared app shell no longer assumes Electrobun RPC is globally available.
- All desktop-only behavior goes through `KloviHostBridge`.
- All server-backed behavior goes through `KloviClient`.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
