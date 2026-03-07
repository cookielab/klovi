# Dev Scripts: Desktop, Bun, and Node Runtimes

## Overview

Three root-level dev scripts targeting different runtimes. Bun and Node variants start the HTTP server + web frontend build concurrently and auto-open the browser.

## Scripts

| Script | What it does |
|---|---|
| `dev:desktop` | Already exists — runs `electrobun dev` |
| `dev:bun` | Builds web (watch) + starts server with `bun --watch` + opens browser |
| `dev:node` | Builds web (watch) + starts server via `npx tsx` + opens browser |

## Changes

### 1. Make `cli.ts` runtime-agnostic

- Replace `import.meta.dir` with `import.meta.dirname` (Bun + Node 22+)
- Change shebang from `#!/usr/bin/env bun` to `#!/usr/bin/env node`
- Add `--no-browser` via `process.argv.includes("--no-browser")`
- Pass `openBrowser` option to `startKloviServer()`

### 2. Implement browser opening in `server.ts`

- After server starts, if `openBrowser` is true, use `child_process.execFile` with platform-appropriate command (`open` on macOS, `xdg-open` on Linux, `start` on Windows)
- Fire-and-forget, no dependency needed

### 3. Root-level scripts in `package.json`

```json
{
  "dev:bun": "bun run --filter @cookielab.io/klovi-web dev & bun run --filter @cookielab.io/klovi dev & wait",
  "dev:node": "bun run --filter @cookielab.io/klovi-web dev & npx tsx apps/server/src/cli.ts & wait"
}
```

Shell `&` for concurrency, `wait` ensures Ctrl+C kills both processes.

### 4. Node runtime detection

Existing `detectRuntime()` in `server.ts` handles bun vs node via `globalThis.Bun` — no changes needed.

## Decisions

- Minimum Node version: 22+ (for `import.meta.dirname`)
- Browser opens by default, `--no-browser` to suppress
- `--no-browser` parsed via simple `process.argv.includes()`
- `dev:bun` uses `bun --watch`, `dev:node` does not (Node needs extra tooling)
- Concurrent processes via shell `&` (no new dependencies)

## Files changed

- `apps/server/src/cli.ts` — runtime-agnostic, `--no-browser`, `openBrowser`
- `apps/server/src/server.ts` — browser-open logic
- `package.json` (root) — add `dev:bun` and `dev:node` scripts
