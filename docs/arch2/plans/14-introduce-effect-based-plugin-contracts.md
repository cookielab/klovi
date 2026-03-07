# 14 Introduce Effect-Based Plugin Contracts

## Why this task exists

Klovi's plugin packages currently mix several incompatible runtime assumptions:

- `ToolPlugin` methods return plain `Promise`s with no typed runtime requirements
- config is stored in mutable module-level state such as `setClaudeCodeDir(...)`
- file access mixes `node:fs`, `Bun.file`, `Bun.Glob`, `Bun.env`, and `process.platform`

That makes the plugin layer hard to run consistently outside Bun and makes server-side registry refresh harder to reason about. The first step is to move the plugin contract itself onto Effect and make runtime dependencies explicit.

Use `@effect/platform` as the default abstraction layer for filesystem, path, and platform-facing services. If a required capability is not covered cleanly, add a small app-owned Effect service rather than falling back to Bun globals inside plugin logic.

## Depends on

- [13-refresh-server-registry-after-plugin-setting-changes.md](./13-refresh-server-registry-after-plugin-setting-changes.md)

## In scope

- Add Effect dependencies to the plugin workspace packages that need them.
- Replace the core plugin contract with Effect-based interfaces.
- Introduce explicit configuration and error types for plugin execution.
- Preserve the existing plugin data models and frontend plugin exports.

## Out of scope

- Migrating concrete Claude Code, Codex, or OpenCode internals.
- Rewriting the server HTTP layer to be fully Effect-based.
- Changing the public `KloviClient` RPC method names.
- Adding caches or memoized plugin state.

## Files/directories to create or change

- `package.json`
- `packages/klovi-plugin-core/package.json`
- `packages/klovi-plugin-claude-code/package.json`
- `packages/klovi-plugin-codex/package.json`
- `packages/klovi-plugin-opencode/package.json`
- `packages/klovi-plugin-core/src/index.ts`
- `packages/klovi-plugin-core/src/plugin-types.ts`
- `packages/klovi-plugin-core/src/plugin-registry.ts`
- `packages/klovi-plugin-core/src/**/*.test.ts`
- new core helpers such as:
  - `packages/klovi-plugin-core/src/plugin-config.ts`
  - `packages/klovi-plugin-core/src/plugin-errors.ts`
  - `packages/klovi-plugin-core/src/plugin-runtime.ts`

## Implementation steps

1. Add `effect` and `@effect/platform` to the packages that participate in plugin execution.
   Runtime-specific packages such as `@effect/platform-node` or `@effect/platform-bun` should be added only where a concrete runtime entrypoint needs them.

2. Replace the `ToolPlugin` contract in `packages/klovi-plugin-core/src/plugin-types.ts` so plugin operations return `Effect.Effect<...>` instead of raw `Promise`s.
   The contract should make runtime needs explicit, for example:
   - configuration access
   - filesystem/path access
   - plugin-specific service dependencies

3. Introduce a small, stable set of core Effect services in `@cookielab.io/klovi-plugin-core`.
   Minimum expectations:
   - a per-plugin configuration service instead of mutable module globals
   - a typed plugin error model
   - optional runtime-runner helpers for app boundaries that still expect `Promise`s

4. Update `PluginRegistry` so registry operations are also Effect-based.
   The registry should combine plugin effects without hiding failures behind shared mutable state.

5. Preserve the current domain models and encoded session ID behavior.
   The migration should not change:
   - `PluginProject`
   - `MergedProject`
   - session summary/session payload shapes
   - frontend plugin contracts

6. Add focused core tests proving the new contract shape works.
   Minimum coverage:
   - a plugin can be instantiated with explicit config rather than module mutation
   - registry methods can run multiple plugin effects and merge results
   - plugin failures remain isolated where current behavior expects partial success

## Acceptance criteria

- `@cookielab.io/klovi-plugin-core` exposes Effect-based plugin contracts.
- Plugin configuration is no longer modeled as required module-level mutable state.
- The core registry can compose plugin operations without relying on Bun globals.
- Existing domain types and frontend plugin exports remain compatible.
- No caching is introduced.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
