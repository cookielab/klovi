# 15 Replace Mutable Plugin Singletons With Effect Layers

## Why this task exists

The current built-in plugin catalog in `apps/server` holds singleton plugin objects and mutates them through `setDir(...)` helpers before registry construction. That design conflicts with both goals of this migration:

- plugin instances cannot safely model runtime requirements through Effect
- registry refresh has to mutate global plugin state before rebuilding
- Node and Bun runtime selection cannot be expressed cleanly per registry instance

This task moves plugin instantiation to explicit factories/layers so every registry build gets fresh plugin instances derived from settings and runtime services.

## Depends on

- [13-refresh-server-registry-after-plugin-setting-changes.md](./13-refresh-server-registry-after-plugin-setting-changes.md)
- [14-introduce-effect-based-plugin-contracts.md](./14-introduce-effect-based-plugin-contracts.md)

## In scope

- Replace built-in plugin singletons with plugin descriptors/factories.
- Make registry creation depend on explicit plugin config and runtime layers.
- Keep the server and RPC surface Promise-based at the edge by running Effects at the boundary.
- Prepare separate Bun and Node runtime providers for plugin execution.

## Out of scope

- Migrating every plugin implementation to Effect internals.
- Replacing Bun as the default runtime for `apps/server`.
- Changing frontend plugin registration.
- Adding new packages under `packages/`.

## Files/directories to create or change

- `apps/server/package.json`
- `apps/server/src/server.ts`
- `apps/server/src/rpc.ts`
- `apps/server/src/services/catalog.ts`
- `apps/server/src/services/auto-discover.ts`
- `apps/server/src/services/registry.ts`
- `apps/server/src/services/app-services.ts`
- `apps/server/src/**/*.test.ts`
- new runtime/provider helpers such as:
  - `apps/server/src/effect/plugin-runtime.ts`
  - `apps/server/src/effect/platform-bun.ts`
  - `apps/server/src/effect/platform-node.ts`

## Implementation steps

1. Replace `BUILTIN_PLUGIN_DESCRIPTORS` so each entry describes how to build a plugin instance from:
   - resolved plugin settings
   - default data-dir logic
   - a runtime/provider layer

2. Remove `setDir(...)`-style mutation from server-owned registry creation.
   The server should no longer mutate module-level plugin config before a registry rebuild.

3. Update `createRegistry(...)` to build fresh plugin instances for each registry creation.
   Required behavior:
   - disabled plugins are skipped
   - custom data-dir overrides apply only to that registry build
   - one plugin instance's config cannot leak into the next rebuild

4. Introduce server-owned Effect runtime helpers.
   Minimum expectation:
   - a Bun provider for today's production path
   - a Node provider so plugin packages can be exercised without Bun-only globals

5. Keep the external server shape stable.
   `startKloviServer(...)`, RPC handlers, and app services may still expose `Promise`s, but they should run plugin effects through the server-owned runtime rather than by calling mutable singleton plugins directly.

6. Align this with Task 13's registry refresh behavior.
   After `updatePluginSetting(...)`, the refreshed registry must be rebuilt from:
   - persisted settings
   - fresh plugin factories
   - the active runtime/provider layer

7. Add focused tests around registry rebuild isolation.
   Minimum coverage:
   - two registry builds with different plugin dirs do not share config
   - disabling a plugin removes it without mutating unrelated plugin instances
   - the refresh path uses fresh plugin instances after settings changes

## Acceptance criteria

- `apps/server` no longer depends on mutating built-in plugin singletons before registry creation.
- Each registry build creates fresh plugin instances from settings plus runtime providers.
- The server can host Bun and Node plugin runtimes through explicit provider modules.
- Task 13's registry-refresh behavior remains intact.
- No caching is introduced.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
