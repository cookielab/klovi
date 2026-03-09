# Move apps/web and apps/server to packages/ — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `apps/web` and `apps/server` into `packages/` so `apps/` only contains deployable targets.

**Architecture:** Two atomic commits. First moves+renames `apps/web` → `packages/ui` (`@cookielab.io/klovi-web` → `@cookielab.io/klovi-ui`). Second moves `apps/server` → `packages/server` (name unchanged). Each commit is self-contained and leaves the workspace in a working state.

**Tech Stack:** Bun workspace monorepo, TypeScript, Biome

---

### Task 1: Move apps/web → packages/ui and rename to @cookielab.io/klovi-ui

**Files:**
- Move: `apps/web/` → `packages/ui/`
- Modify: `packages/ui/package.json` (name field)
- Modify: `apps/desktop/package.json` (dependency)
- Modify: `apps/desktop/src/views/main/index.ts` (4 imports)
- Modify: `apps/package/package.json` (dependency + build script)
- Modify: `apps/package/src/cli.ts` (path resolution)
- Modify: `package.json` (root build:web script)

**Step 1: Move the directory**

```bash
git mv apps/web packages/ui
```

**Step 2: Rename package in packages/ui/package.json**

Change line 2:
```json
"name": "@cookielab.io/klovi-web",
```
→
```json
"name": "@cookielab.io/klovi-ui",
```

**Step 3: Update apps/desktop/package.json dependency**

Change line 27:
```json
"@cookielab.io/klovi-web": "workspace:*",
```
→
```json
"@cookielab.io/klovi-ui": "workspace:*",
```

**Step 4: Update apps/desktop/src/views/main/index.ts imports**

Replace all 4 occurrences of `@cookielab.io/klovi-web` with `@cookielab.io/klovi-ui`:

```typescript
// Line 1
import type { KloviHostBridge, KloviHostCapabilities } from "@cookielab.io/klovi-ui/bootstrap";
// Line 2
import { createHttpClient, mountKloviApp } from "@cookielab.io/klovi-ui/bootstrap";
// Line 7
import "@cookielab.io/klovi-ui/styles";
// Line 10
import "@cookielab.io/klovi-ui/app/App.css";
```

**Step 5: Update apps/package/package.json**

5a. Change dependency (line 38):
```json
"@cookielab.io/klovi-web": "workspace:*",
```
→
```json
"@cookielab.io/klovi-ui": "workspace:*",
```

5b. Change build:web-assets script (line 32). The relative path `../web/dist` no longer works because web moved from `apps/web` to `packages/ui`. New path from `apps/package/` to `packages/ui/`:
```json
"build:web-assets": "rm -rf dist/web && cp -r ../web/dist dist/web",
```
→
```json
"build:web-assets": "rm -rf dist/web && cp -r ../../packages/ui/dist dist/web",
```

**Step 6: Update apps/package/src/cli.ts path resolution**

Change line 13:
```typescript
return resolve(__dir, "../node_modules/@cookielab.io/klovi-web/dist");
```
→
```typescript
return resolve(__dir, "../node_modules/@cookielab.io/klovi-ui/dist");
```

**Step 7: Update root package.json build:web script**

Change line 15:
```json
"build:web": "bun run --filter @cookielab.io/klovi-web build",
```
→
```json
"build:web": "bun run --filter @cookielab.io/klovi-ui build",
```

**Step 8: Regenerate lockfile**

```bash
bun install
```

**Step 9: Verify**

```bash
bun run check
bun run typecheck
bun test
```

Expected: all pass.

**Step 10: Commit**

```bash
git add -A
git commit -m "refactor: move apps/web → packages/ui, rename to @cookielab.io/klovi-ui"
```

---

### Task 2: Move apps/server → packages/server

**Files:**
- Move: `apps/server/` → `packages/server/`

**Step 1: Move the directory**

```bash
git mv apps/server packages/server
```

**Step 2: Regenerate lockfile**

```bash
bun install
```

**Step 3: Verify**

```bash
bun run check
bun run typecheck
bun test
```

Expected: all pass. The package name `@cookielab.io/klovi-server` is unchanged, so no import updates needed. Bun resolves workspace packages by name, not path.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move apps/server → packages/server"
```

---

### Task 3: Update docs

**Files:**
- Modify: `docs/arch2/VISION.md` — replace `apps/web` → `packages/ui`, `apps/server` → `packages/server`
- Modify: `docs/arch2/README.md` — same replacements
- Modify: other `docs/arch2/plans/*.md` files that reference `apps/web` or `apps/server` paths

**Step 1: Bulk update arch2 docs**

Search all files under `docs/` for `apps/web` and `apps/server` path references. Replace:
- `apps/web` → `packages/ui`
- `apps/server` → `packages/server`
- `@cookielab.io/klovi-web` → `@cookielab.io/klovi-ui` (in docs only — source already done)

**Step 2: Verify**

```bash
bun run check
```

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: update path references for packages/ui and packages/server"
```
