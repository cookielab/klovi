# Bun-Only Optimization Design

## Context

Klovi previously needed Node.js compatibility. Now it exclusively targets Bun/Electrobun. The codebase is ~80% migrated already. This design covers the pragmatic remaining cleanup.

## What stays as-is

- `node:path` and `node:os` — Bun supports these natively, zero-cost
- `node:fs/promises` for `mkdir`, `readdir`, `rename`, `rm`, `stat` — no Bun-native alternatives
- `process.platform`, `process.arch`, `process.execPath`, `process.pid` — Bun-compatible
- Electrobun patch file — dependency patches, not project code
- tsconfig.json and package.json — already Bun-configured

## Changes

### 1. `src/plugins/auto-discover.ts`

Replace `stat()` existence check with `Bun.file(path).exists()`. Removes the `node:fs/promises` import entirely.

### 2. `src/bun/rpc-handlers.ts`

Replace `unlink()` with `rm()` from `node:fs/promises` for consistency with the rest of the codebase.

### 3. Documentation

Update code examples in `docs/plans/` and `docs/testing.md` that show sync Node.js patterns to use async Bun patterns.
