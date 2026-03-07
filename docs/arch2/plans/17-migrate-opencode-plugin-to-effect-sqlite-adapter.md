# 17 Migrate OpenCode Plugin To Effect SQLite Adapter

## Why this task exists

The OpenCode plugin is the main Bun-only holdout in the plugin layer because its database access is built around `bun:sqlite`. If the goal is to run the same plugin packages under both Bun and Node, database access must move behind an explicit service boundary instead of being imported directly from plugin logic.

This task isolates SQLite behind an Effect service and keeps all OpenCode discovery/parsing code runtime-agnostic.

## Depends on

- [14-introduce-effect-based-plugin-contracts.md](./14-introduce-effect-based-plugin-contracts.md)
- [15-replace-mutable-plugin-singletons-with-effect-layers.md](./15-replace-mutable-plugin-singletons-with-effect-layers.md)

## In scope

- Introduce a read-only OpenCode database service for plugin logic.
- Move Bun-specific SQLite access into an adapter layer.
- Add a Node-capable adapter so the plugin can run outside Bun.
- Migrate OpenCode filesystem/config access to the same Effect model used by the other plugins.

## Out of scope

- Changing the OpenCode schema assumptions supported today.
- Adding a caching layer on top of SQLite reads.
- Rewriting the OpenCode frontend plugin.
- Changing app-level RPC method shapes.

## Files/directories to create or change

- `packages/klovi-plugin-opencode/package.json`
- `packages/klovi-plugin-opencode/src/index.ts`
- `packages/klovi-plugin-opencode/src/config.ts`
- `packages/klovi-plugin-opencode/src/db.ts`
- `packages/klovi-plugin-opencode/src/discovery.ts`
- `packages/klovi-plugin-opencode/src/parser.ts`
- `packages/klovi-plugin-opencode/src/**/*.test.ts`
- new adapter files such as:
  - `packages/klovi-plugin-opencode/src/sqlite-service.ts`
  - `packages/klovi-plugin-opencode/src/runtime/bun-sqlite.ts`
  - `packages/klovi-plugin-opencode/src/runtime/node-sqlite.ts`

## Implementation steps

1. Define a minimal read-only SQLite service for OpenCode plugin logic.
   It should support only the operations the plugin actually needs:
   - opening a database
   - running parameterized queries
   - closing/bracketing the connection safely

2. Move SQL strings, schema inspection, and row-to-domain mapping into runtime-agnostic modules.
   The OpenCode plugin logic should not import `bun:sqlite` or any Node driver directly.

3. Implement a Bun adapter behind that service using the current Bun SQLite path.
   This preserves today's production behavior while isolating the runtime-specific code.

4. Implement a Node adapter behind the same service.
   The adapter choice should be made at the runtime/provider layer, not inside OpenCode discovery logic.
   If the target Node runtime offers a suitable built-in SQLite path, prefer that. Otherwise, use one maintained driver and keep it isolated to the adapter file.

5. Convert OpenCode config, DB access, discovery, and parsing entrypoints to the Effect-based contract.
   Required result:
   - plugin logic uses Effect services for config, filesystem/path access, and SQLite access
   - only the adapter modules know which runtime is active

6. Add contract-style tests that run the same OpenCode fixture behavior through both adapters where feasible.
   Minimum coverage:
   - schema inspection behavior
   - project discovery
   - session listing
   - session loading

## Acceptance criteria

- OpenCode plugin logic no longer imports `bun:sqlite` directly.
- Bun-specific and Node-specific SQLite behavior is isolated to adapter modules.
- OpenCode participates in the same Effect-based plugin contract as the other plugins.
- The supported OpenCode discovery/parser behavior remains stable.
- No caching is introduced.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
