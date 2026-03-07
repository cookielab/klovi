# 19 Migrate Server To Effect Platform

## Why this task exists

The plugin layer is being moved onto Effect so it can run on both Bun and Node, but `apps/server` is still Bun-only in its core execution path. Today the server depends directly on:

- `Bun.serve` for HTTP startup
- `Bun.file` and `Bun.write` for settings and static assets
- `Bun.env` and `process.platform` for runtime configuration
- a Bun-only `ManagedRuntime` in `apps/server/src/effect/plugin-runtime.ts`
- mutable module state in `apps/server/src/services/app-services.ts` for version metadata

That means the published server package cannot actually be treated as a dual-runtime Effect application yet. This task migrates the server onto `@effect/platform` so the shared server logic can run on Bun and Node, with only thin runtime-specific adapters at the edge.

## Depends on

- [13-refresh-server-registry-after-plugin-setting-changes.md](./13-refresh-server-registry-after-plugin-setting-changes.md)
- [18-add-node-and-bun-plugin-runtime-coverage.md](./18-add-node-and-bun-plugin-runtime-coverage.md)

## In scope

- Move the shared HTTP server implementation onto `@effect/platform`.
- Extract a transport-neutral Effect service layer for server-backed application operations.
- Isolate Bun-specific and Node-specific startup code behind separate runtime layers.
- Replace Bun-global filesystem and env access in `apps/server` with Effect services.
- Keep the public `startKloviServer(options)` API and `POST /api/rpc/:method` surface stable.
- Make the server package executable under Bun and Node without introducing caching.
- Ensure the same server core can be consumed through:
  - HTTP for the browser-served web app
  - an exported Effect layer/service API for Electrobun embedding

## Out of scope

- Replacing Bun as the repo's default toolchain or test runner.
- Changing RPC method names, payload shapes, or frontend call sites.
- Migrating Electrobun desktop shell logic away from desktop mode.
- Reworking plugin parsing or registry semantics beyond what is needed for runtime-neutral server wiring.
- Adding caches, background workers, or precomputed registries.
- Reintroducing duplicated desktop-only server-backed handlers through Electrobun RPC.

## Files/directories to create or change

- `apps/server/package.json`
- `apps/server/src/server.ts`
- `apps/server/src/index.ts`
- `apps/server/src/cli.ts`
- `apps/server/src/rpc.ts`
- `apps/server/src/services/app-services.ts`
- `apps/server/src/services/settings.ts`
- `apps/server/src/effect/plugin-runtime.ts`
- `apps/server/src/effect/platform-bun.ts`
- `apps/server/src/effect/platform-node.ts`
- `apps/server/src/**/*.test.ts`
- new shared/runtime modules such as:
  - `apps/server/src/effect/server-services.ts`
  - `apps/server/src/effect/http-app.ts`
  - `apps/server/src/effect/server-runtime.ts`
  - `apps/server/src/effect/server-config.ts`
  - `apps/server/src/effect/server-metadata.ts`

## Implementation steps

1. Introduce an Effect-owned server composition root.
   Create a shared server layer that owns:
   - server config
   - settings path resolution
   - plugin runtime selection
   - version metadata
   - registry construction and lifecycle
   - transport-neutral server application services

   Required result:
   - shared server code no longer depends on module-level `setVersion(...)`
   - shared server code no longer hardcodes `ManagedRuntime.make(BunPluginLayer)`
   - the core server-backed operations are available as Effect services before any HTTP adapter is applied

2. Extract the existing server-backed application methods behind an Effect service boundary.
   This service layer should cover the operations currently surfaced through RPC, for example:
   - version, stats, projects, sessions, search
   - plugin settings and general settings
   - first-launch and reset-settings behavior

   Transport rule:
   - the business logic lives once in the Effect service layer
   - HTTP handlers call that layer
   - Electrobun embedding may call that layer directly when in-process access is preferable
   - desktop-native features remain outside this layer and stay on the `KloviHostBridge` / Electrobun side

3. Rebuild the HTTP surface with `@effect/platform` primitives.
   Use `HttpRouter`, `HttpServerRequest`, `HttpServerResponse`, and `HttpServer` to define:
   - `POST /api/rpc/:method`
   - static asset serving for browser mode
   - SPA fallback to `index.html`
   - consistent 400, 404, and 500 responses

   Preserve current behavior:
   - unknown RPC methods still return 404
   - invalid JSON bodies still return 400
   - RPC error messages remain JSON responses

4. Replace Bun-global filesystem, path, and env access with Effect services.
   Migrate `apps/server` code to `@effect/platform` `FileSystem` and `Path` services, plus Effect config/environment handling where needed.

   Minimum targets:
   - settings load/save/reset and first-launch detection
   - static file lookup
   - package metadata loading for version/commit
   - default settings path resolution across macOS and non-macOS environments
   - CLI host/port/static-dir configuration

5. Split Bun and Node runtime adapters cleanly.
   The shared HTTP app must import only runtime-agnostic modules. Runtime-specific modules should provide the server layer and platform context:
   - Bun path: `@effect/platform-bun` with `BunHttpServer` and `BunContext`
   - Node path: `@effect/platform-node` with `NodeHttpServer` and `NodeContext`

   Required result:
   - Bun-only globals stay in Bun adapter files
   - Node-only imports such as `node:http` stay in Node adapter files
   - `apps/server/src/server.ts` remains importable from both runtimes

6. Preserve the existing embedding and CLI contracts.
   `startKloviServer(options)` must still return a `{ url, stop() }` handle, but it should now be backed by an Effect scope/fiber so shutdown is deterministic in both runtimes.

   The implementation should choose one of these explicit patterns and document it in code:
   - `startKloviServer({ runtime: "auto" | "bun" | "node", ... })`
   - or thin runtime-specific wrappers that delegate to the same shared Effect app

   In either case:
   - desktop embedding through `@cookielab.io/klovi/server` must keep working
   - Bun remains the default local entry path
   - a Node-startable path must exist for smoke coverage and package consumers
   - Electrobun must be able to obtain the same server-backed operations through an exported Effect layer/service API without duplicating handler logic

7. Keep the communication split explicit.
   The migration must preserve two distinct communication layers:
   - HTTP transport for the browser-served web app and any remote-like embedding path
   - Effect layer/service access for in-process Electrobun integration

   Required boundary:
   - server-backed data operations come from the shared Effect server layer
   - desktop-native operations do not move into the HTTP API
   - Electrobun RPC does not become a second copy of the server-backed business logic

8. Add focused coverage for both runtime and transport modes.
   Keep `bun run check`, `bun run typecheck`, and `bun test` as the default verification path, then add targeted server compatibility coverage that proves:
   - the shared server module imports under Node
   - Bun runtime startup still works
   - Node runtime startup works through the Effect adapter
   - RPC requests succeed under both runtimes
   - static asset serving and SPA fallback behave the same in both runtimes
   - the transport-neutral Effect service layer can be exercised directly without going through HTTP
   - Electrobun-facing integration can consume the shared server layer without reimplementing RPC handlers

   Prefer smoke or contract-style coverage over cloning the whole Bun suite.

## Acceptance criteria

- Shared server logic uses `@effect/platform` HTTP, filesystem, and path abstractions instead of Bun globals.
- Server-backed application logic is exposed first as a transport-neutral Effect service/layer, then adapted to HTTP.
- Bun-specific and Node-specific server startup are isolated to runtime adapter files.
- `startKloviServer(options)` remains the stable embedding API and can be started from Bun and Node.
- The server package no longer requires Bun-only globals in shared modules such as `server.ts`, `settings.ts`, and `app-services.ts`.
- The same server core is consumable through HTTP for the web app and through an Effect layer/service API for Electrobun embedding.
- Electrobun RPC is not used to duplicate server-backed business logic.
- Version metadata, settings access, and plugin runtime wiring are expressed through Effect services/layers instead of mutable module state.
- No caching is introduced.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
