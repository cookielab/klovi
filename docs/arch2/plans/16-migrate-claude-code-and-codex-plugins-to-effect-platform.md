# 16 Migrate Claude Code And Codex Plugins To Effect Platform

## Why this task exists

The Claude Code and Codex plugins are the cleanest migration target because both are file-backed and already share similar responsibilities:

- discovering projects from on-disk session files
- scanning JSONL or JSONL-like data
- reading partial file prefixes for fast metadata extraction
- exposing the same frontend plugin surface as today

They also currently depend on Bun-specific or process-global APIs such as `Bun.file`, `Bun.Glob`, `Bun.env`, and `process.platform`. Moving these two plugins onto `@effect/platform` establishes the reusable file/path patterns needed for the rest of the plugin system.

## Depends on

- [14-introduce-effect-based-plugin-contracts.md](./14-introduce-effect-based-plugin-contracts.md)
- [15-replace-mutable-plugin-singletons-with-effect-layers.md](./15-replace-mutable-plugin-singletons-with-effect-layers.md)

## In scope

- Convert Claude Code and Codex plugin internals to Effect-based implementations.
- Replace direct Bun and process-global filesystem/platform access with `@effect/platform` services.
- Remove module-level mutable config from these packages.
- Keep parser output, session IDs, and frontend plugin exports stable.

## Out of scope

- Changing Claude Code or Codex parsing semantics.
- Migrating the OpenCode plugin.
- Rewriting the shared UI behavior for these plugins.
- Adding caches or precomputed indexes beyond what already exists on disk.

## Files/directories to create or change

- `packages/klovi-plugin-claude-code/package.json`
- `packages/klovi-plugin-claude-code/src/index.ts`
- `packages/klovi-plugin-claude-code/src/config.ts`
- `packages/klovi-plugin-claude-code/src/discovery.ts`
- `packages/klovi-plugin-claude-code/src/parser.ts`
- `packages/klovi-plugin-claude-code/src/shared/**/*.ts`
- `packages/klovi-plugin-claude-code/src/**/*.test.ts`
- `packages/klovi-plugin-codex/package.json`
- `packages/klovi-plugin-codex/src/index.ts`
- `packages/klovi-plugin-codex/src/config.ts`
- `packages/klovi-plugin-codex/src/discovery.ts`
- `packages/klovi-plugin-codex/src/session-index.ts`
- `packages/klovi-plugin-codex/src/shared/**/*.ts`
- `packages/klovi-plugin-codex/src/**/*.test.ts`

## Implementation steps

1. Convert each package's config module from mutable setters/getters to explicit config access through the Effect-based plugin contract.
   Required result:
   - no server-owned caller needs `setClaudeCodeDir(...)` or `setCodexCliDir(...)`

2. Replace direct filesystem and environment access with `@effect/platform` services.
   Minimum targets:
   - directory listing
   - path joins/path normalization
   - file existence checks
   - reading file prefixes and full text
   - home-directory and platform detection

3. Consolidate duplicated file helpers where the two packages already share the same behavior.
   The migration should prefer reusable helpers inside the existing packages over copy-paste forks.

4. Rewrite discovery and session listing flows as Effects while preserving existing behavior.
   Required behavior to preserve:
   - malformed or missing files should still be tolerated where current code tolerates them
   - project/session ordering should remain descending by timestamp
   - partial discovery failure for one file or directory should not fail the whole plugin

5. Keep parser and frontend exports stable for consumers.
   Existing named exports should continue to exist unless a rename is unavoidable and documented in the package entrypoint.

6. Add regression tests that exercise the Effect-based runtime path.
   Minimum coverage:
   - temp-directory discovery works with explicit plugin config
   - session metadata extraction still handles malformed lines gracefully
   - plugin `isDataAvailable` behavior no longer depends on Bun globals

## Acceptance criteria

- Claude Code and Codex plugin packages no longer depend on `Bun.file`, `Bun.Glob`, `Bun.env`, or mutable config setters in their core execution path.
- Both plugins run through the Effect-based plugin contract introduced in Task 14.
- Existing parser/discovery behavior stays stable.
- Frontend plugin exports remain usable by current UI code.
- No caching is introduced.

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
