# 09 Start Embedded Server From Electrobun

## Why this task exists

Desktop mode must use the same backend path as browser mode. This task makes Electrobun start the embedded server and point the shared app at it.

## Depends on

- [07-publish-apps-server-as-@cookielab.io-klovi.md](./07-publish-apps-server-as-@cookielab.io-klovi.md)
- [08-reduce-desktop-rpc-to-native-host-bridge.md](./08-reduce-desktop-rpc-to-native-host-bridge.md)

## In scope

- Start the local server from desktop mode.
- Provide the shared app with a `KloviClient` that points at the embedded server.
- Keep desktop mounting the shared app through Electrobun.

## Out of scope

- Root dev/build workflows.
- Final browser capability gating.

## Files/directories to create or change

- `apps/desktop/src/bun/index.ts`
- `apps/desktop/src/views/main/index.ts`
- desktop runtime config/bootstrap files
- `apps/server/src/server.ts` or exported server entry if needed for embedding

## Implementation steps

1. Make the desktop package depend on the workspace `@cookielab.io/klovi` package.
2. Import `startKloviServer(options)` from `@cookielab.io/klovi/server`.
3. Start the embedded server on a local port in desktop mode.
4. Pass the resulting API base URL into `mountKloviApp(config)` when mounting the shared app.
5. Keep Electrobun responsible only for desktop shell and native host bridge behavior.

## Acceptance criteria

- Desktop mode starts the embedded server.
- The shared app in desktop mode uses the same server-backed method surface as browser mode.
- Electrobun remains the desktop shell and native integration layer.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
