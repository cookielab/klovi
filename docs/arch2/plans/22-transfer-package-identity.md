# Transfer Package Identity

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transfer the `@cookielab.io/klovi` package name from `apps/server` to `apps/package`, rename `apps/server` to `@cookielab.io/klovi-server`, and update all consumers.

**Architecture:** `apps/server` becomes `@cookielab.io/klovi-server` (internal). `apps/package` becomes `@cookielab.io/klovi` (published). All workspace dependencies and import paths are updated atomically. Root workspace scripts are updated to use the new names.

**Tech Stack:** Bun workspaces, TypeScript

**Depends on:** [21-create-apps-package.md](./21-create-apps-package.md)

---

### Task 1: Rename apps/server to @cookielab.io/klovi-server

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Update the package name and remove CLI-related fields**

Change the `name` field from `@cookielab.io/klovi` to `@cookielab.io/klovi-server`. Remove the `bin` field (CLI moves to apps/package). Remove the `@cookielab.io/klovi-web` dependency (server should not depend on web).

In `apps/server/package.json`, make these changes:
- `"name": "@cookielab.io/klovi"` → `"name": "@cookielab.io/klovi-server"`
- Remove the `"bin"` field entirely
- Remove `"@cookielab.io/klovi-web": "workspace:*"` from dependencies

**Step 2: Run bun install**

Run: `bun install`
Expected: Lockfile updates to reflect the renamed package. May see errors from consumers that still reference the old name — that's expected and will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add apps/server/package.json bun.lock
git commit -m "refactor(server): rename to @cookielab.io/klovi-server"
```

---

### Task 2: Rename apps/package to @cookielab.io/klovi

**Files:**
- Modify: `apps/package/package.json`

**Step 1: Update the package name**

Change `"name": "@cookielab.io/klovi-package"` to `"name": "@cookielab.io/klovi"`.

**Step 2: Update dependencies to use new server name**

Change `"@cookielab.io/klovi": "workspace:*"` to `"@cookielab.io/klovi-server": "workspace:*"` in the dependencies.

**Step 3: Update all imports in apps/package source files**

Update every import from `@cookielab.io/klovi/...` to `@cookielab.io/klovi-server/...` in:
- `apps/package/src/server.ts`
- `apps/package/src/http-app.ts`

Specifically:
- `@cookielab.io/klovi/effect/http-app` → `@cookielab.io/klovi-server/effect/http-app`
- `@cookielab.io/klovi/effect/server-config` → `@cookielab.io/klovi-server/effect/server-config`
- `@cookielab.io/klovi/effect/server-services` → `@cookielab.io/klovi-server/effect/server-services`
- `@cookielab.io/klovi/effect/platform-bun` → `@cookielab.io/klovi-server/effect/platform-bun`
- `@cookielab.io/klovi/effect/platform-node` → `@cookielab.io/klovi-server/effect/platform-node`
- `@cookielab.io/klovi/effect/plugin-runtime` → `@cookielab.io/klovi-server/effect/plugin-runtime`

**Step 4: Run bun install**

Run: `bun install`
Expected: Workspace resolves correctly.

**Step 5: Commit**

```bash
git add apps/package/package.json apps/package/src/server.ts apps/package/src/http-app.ts bun.lock
git commit -m "refactor(package): rename to @cookielab.io/klovi, update server imports"
```

---

### Task 3: Update apps/desktop dependencies and imports

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src/bun/index.ts`

**Step 1: Update package.json dependency**

In `apps/desktop/package.json`, change:
- `"@cookielab.io/klovi": "workspace:*"` → `"@cookielab.io/klovi-server": "workspace:*"`

**Step 2: Update imports in desktop main process**

In `apps/desktop/src/bun/index.ts`, update all imports from the old server package name:
- `@cookielab.io/klovi/server` → `@cookielab.io/klovi-server/server`
- `@cookielab.io/klovi/services/app-services` → `@cookielab.io/klovi-server/services/app-services`

Specifically:
```ts
// Before:
import { startKloviServer } from "@cookielab.io/klovi/server";
import {
  getUpdateSettings,
  setVersion,
  updateUpdateSettings,
} from "@cookielab.io/klovi/services/app-services";

// After:
import { startKloviServer } from "@cookielab.io/klovi-server/server";
import {
  getUpdateSettings,
  setVersion,
  updateUpdateSettings,
} from "@cookielab.io/klovi-server/services/app-services";
```

**Step 3: Run bun install**

Run: `bun install`

**Step 4: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/bun/index.ts bun.lock
git commit -m "refactor(desktop): update to @cookielab.io/klovi-server imports"
```

---

### Task 4: Update root workspace scripts

**Files:**
- Modify: `package.json` (root)

**Step 1: Update dev scripts**

Update root `package.json` scripts that reference the old package names:

```json
{
  "scripts": {
    "dev": "bun run --filter @cookielab.io/klovi-desktop dev",
    "dev:desktop": "bun run --filter @cookielab.io/klovi-desktop dev",
    "dev:web": "bun run --filter @cookielab.io/klovi-web dev",
    "dev:bun": "bun run --filter @cookielab.io/klovi-web dev & bun run --filter @cookielab.io/klovi dev & wait",
    "dev:node": "bun run --filter @cookielab.io/klovi-web dev & npx tsx apps/package/src/cli.ts & wait",
    "dev:server": "bun run --filter @cookielab.io/klovi-server start",
    "build": "bun run --filter @cookielab.io/klovi-desktop build",
    "build:web": "bun run --filter @cookielab.io/klovi-web build"
  }
}
```

Key changes:
- `dev:bun` now uses `@cookielab.io/klovi` which is `apps/package`
- `dev:node` now points to `apps/package/src/cli.ts`
- `dev:server` now uses `@cookielab.io/klovi-server`

Note: Only change the scripts listed above. Leave all other scripts (`test`, `typecheck`, `lint`, `format`, `check`, `check:fix`, `storybook`, `test:node-smoke`) unchanged.

**Step 2: Run verification**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass.

**Step 3: Commit**

```bash
git add package.json
git commit -m "refactor: update root workspace scripts for new package names"
```

---

## Dependency Graph

- Task 1 has no prerequisites.
- Task 2 depends on Task 1.
- Task 3 depends on Task 1.
- Task 4 depends on Tasks 2 and 3.

## Acceptance Criteria

- `apps/server/package.json` has name `@cookielab.io/klovi-server`.
- `apps/package/package.json` has name `@cookielab.io/klovi`.
- `apps/desktop` imports from `@cookielab.io/klovi-server/...` paths.
- `apps/package` imports from `@cookielab.io/klovi-server/...` paths.
- Root workspace scripts reference correct package names.
- `bun install` resolves all workspace dependencies.
- `bun run check`, `bun run typecheck`, `bun test` all pass.
