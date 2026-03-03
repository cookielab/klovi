# Bun-Only Optimization Design

## Context

Klovi previously needed Node.js compatibility. Now it exclusively targets Bun/Electrobun. The codebase is ~90% migrated already. This design covers targeted replacements where Bun has genuinely better APIs.

## What stays as-is

- `node:path` and `node:os` — Bun supports these natively, zero-cost
- `node:fs/promises` for `mkdir`, `readdir` (with Dirents), `rename`, `rm`, `stat` — no Bun-native alternatives
- `readDirEntriesSafe` — needs `Dirent` interface, not replaceable by `Bun.Glob`
- `process.platform`, `process.arch`, `process.execPath`, `process.pid` — Bun-compatible
- Electrobun patch file — dependency patches, not project code
- tsconfig.json and package.json — already Bun-configured

## Changes

### 1. Replace `compareVersions()` with `Bun.semver`

**File:** `src/bun/updater.ts:20-52`

Remove the 32-line custom `compareVersions` function. Replace with `Bun.semver.order(a, b)` which returns -1, 0, 1 and handles pre-release ordering correctly (alpha < beta < rc < release).

### 2. Replace `setTimeout` delay with `Bun.sleep()`

**File:** `src/bun/updater.ts:297`

Replace `await new Promise(resolve => setTimeout(resolve, delay))` with `await Bun.sleep(delay)`.

### 3. Replace `listFilesBySuffix` with `Bun.Glob`

**Files:** `packages/klovi-plugin-claude-code/src/shared/discovery-utils.ts`, `packages/klovi-plugin-codex/src/shared/discovery-utils.ts`

Replace `readdir()` + `.filter(f => f.endsWith(suffix))` with `new Bun.Glob("*" + suffix).scanSync({ cwd: dir })`. If the `readdir` import becomes unused after this change, remove it.

### 4. Clean up workspace `package.json` files

**Files:** All 6 `packages/*/package.json`

Remove redundant `main`, `module`, `types` fields. Bun resolves via the `exports` field. These are leftover Node.js bundler compatibility fields.
