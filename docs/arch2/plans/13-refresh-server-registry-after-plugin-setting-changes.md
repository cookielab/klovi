# 13 Refresh Server Registry After Plugin Setting Changes

## Why this task exists

Arch2 moved the application service layer into `apps/server`, but the current runtime builds a single `PluginRegistry` once during server startup and stores it in the RPC context. That breaks a core settings flow in server/browser mode:

- `updatePluginSetting(...)` writes the settings file
- `getPluginSettings()` returns the updated configuration
- `getProjects()`, `getStats()`, `getSessions()`, `getSession()`, and `searchSessions()` still use the old in-memory registry until restart

The result is a misleading UI state where plugin settings appear saved, but the live server behavior does not match them.

## Depends on

- [04-extract-server-application-services.md](./04-extract-server-application-services.md)
- [05-add-http-rpc-surface.md](./05-add-http-rpc-surface.md)
- [12-expand-test-and-smoke-coverage.md](./12-expand-test-and-smoke-coverage.md)

## In scope

- Replace the one-time server registry snapshot with a refreshable server-owned registry state.
- Ensure plugin setting changes take effect immediately for subsequent server-backed requests.
- Add tests that prove server/browser mode observes plugin enable/disable and data-dir changes without restart.

## Out of scope

- Changing the public `KloviClient` method names.
- Adding caches or memoized registry layers.
- Redesigning plugin settings UX.
- Changing desktop updater or host-bridge behavior.

## Files/directories to create or change

- `apps/server/src/server.ts`
- `apps/server/src/rpc.ts`
- `apps/server/src/services/app-services.ts`
- `apps/server/src/services/auto-discover.ts` if helper extraction is needed
- `apps/server/src/server.test.ts`
- `apps/server/src/integration.test.ts`
- `apps/server/src/services/settings-handlers.test.ts`
- any new focused tests under `apps/server/src/**/*.test.ts`

## Implementation steps

1. Introduce a server-owned registry state abstraction in `apps/server/src/server.ts` or `apps/server/src/rpc.ts`.
   It must expose:
   - a way to read the current `PluginRegistry`
   - a way to rebuild the registry from the latest settings file

2. Stop storing a plain `PluginRegistry` value in the RPC context.
   Replace it with a refreshable registry holder such as:
   - `getRegistry(): Promise<PluginRegistry> | PluginRegistry`
   - `refreshRegistry(): Promise<void>`

3. Update all server-backed read methods to resolve the current registry at call time rather than closing over the startup snapshot.
   This applies to:
   - `getStats`
   - `getProjects`
   - `getSessions`
   - `getSession`
   - `getSubAgent`
   - `searchSessions`

4. Update the `updatePluginSetting(...)` RPC path so it refreshes the server registry after the settings file is successfully written.
   Ordering requirement:
   - write settings first
   - rebuild registry second
   - return the updated plugin settings response only after the new registry is live

5. Decide and document the failure behavior for registry refresh.
   Required default:
   - if writing settings fails, return the write error and leave the old registry intact
   - if registry rebuild fails after settings were written, return an error rather than claiming success
   - do not silently keep stale runtime state after reporting success

6. Keep the implementation cache-free.
   The fix must rely on rebuilding from the source-of-truth settings file, not on layered caches or invalidation logic.

7. Add tests that reproduce the bug and prove the fix.
   Minimum coverage:
   - server startup uses initial settings
   - `updatePluginSetting({ enabled: false })` removes that plugin from subsequent registry-backed reads without restart
   - `updatePluginSetting({ dataDir: ... })` affects subsequent registry-backed reads without restart
   - a failed refresh path does not report success

## Acceptance criteria

- Plugin setting changes take effect immediately in server/browser mode without restarting the process.
- After `updatePluginSetting(...)` succeeds, subsequent server-backed read calls use a registry rebuilt from the latest settings.
- The server does not report successful plugin-setting mutation while still serving stale registry-backed results.
- The fix does not introduce caching.
- Regression tests cover the stale-registry scenario.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
