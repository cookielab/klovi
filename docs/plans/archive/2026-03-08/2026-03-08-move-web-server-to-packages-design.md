# Move apps/web and apps/server to packages/

**Date:** 2026-03-08
**Goal:** Ensure `apps/` contains only real deployable targets (`desktop`, `package`), moving shared libraries to `packages/`.

## Changes

### Commit 1: Move apps/web → packages/ui

- **Directory move:** `apps/web/` → `packages/ui/`
- **Package rename:** `@cookielab.io/klovi-web` → `@cookielab.io/klovi-ui`
- **Source updates:**
  - `apps/desktop/src/views/main/index.ts` — 4 imports `klovi-web` → `klovi-ui`
  - `apps/desktop/package.json` — dependency rename
  - `apps/package/package.json` — dependency rename
  - `apps/package/src/cli.ts` — path resolution reference
  - `packages/ui/package.json` — name field
  - `package.json` — `build:web` filter script
- **Doc updates:** Active references in `docs/` files

### Commit 2: Move apps/server → packages/server

- **Directory move:** `apps/server/` → `packages/server/`
- **No package rename** — stays `@cookielab.io/klovi-server`
- **Source updates:** None (package name unchanged, imports unaffected)
- **Doc updates:** Path references `apps/server` → `packages/server`

## Result

```
apps/
├── desktop/    # Electrobun desktop app
└── package/    # npm publishable package

packages/
├── design-system/
├── plugin-claude-code/
├── plugin-codex/
├── plugin-core/
├── plugin-opencode/
├── server/          # (moved from apps/server)
├── ui/              # (moved from apps/web)
└── ui-components/
```
