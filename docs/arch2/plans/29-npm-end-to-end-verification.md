# NPM End-To-End Verification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify that `npx @cookielab.io/klovi` and `bunx @cookielab.io/klovi` both work end-to-end, and fix any issues found.

**Architecture:** The NPM package (`apps/package`) starts the backend server, composes HTTP routing (`/api/*` → server RPC, `/*` → web assets with SPA fallback), and opens the user's browser. It must work under both Node and Bun runtimes. The build pipeline (plan 24) produces the compiled JS; this plan verifies the full user-facing flow.

**Depends on:** Plans 13, 24, 25, 26

---

## Verification checklist

### Build verification

1. `bun run build` at workspace root succeeds (web → server → package)
2. `apps/package/dist/cli.js` exists with correct shebang
3. `apps/server/dist/` contains compiled JS
4. `apps/web/dist/` contains built HTML/JS/CSS assets

### Node runtime (`npx` simulation)

5. `node apps/package/dist/cli.js --no-browser` starts the server
6. Server binds to `127.0.0.1:3131` (or configured port)
7. `GET /` returns the web app's `index.html`
8. `GET /index.html` returns the web app's `index.html`
9. `GET /<hashed-asset>.js` returns the correct JS bundle
10. `GET /some/deep/route` returns `index.html` (SPA fallback)
11. `POST /api/rpc/getVersion` returns version info
12. `POST /api/rpc/getProjects` returns project data
13. `POST /api/rpc/getPluginSettings` returns settings
14. `POST /api/rpc/unknownMethod` returns 404
15. `POST /api/rpc/` (no method) returns 400
16. The UI loads correctly in a browser at `http://127.0.0.1:3131`

### Bun runtime (`bunx` simulation)

17. `bun apps/package/dist/cli.js --no-browser` starts the server
18. All checks 6-16 pass under Bun runtime
19. Runtime auto-detection selects Bun (`globalThis.Bun` is defined)

### Port conflict handling

20. Starting with a port already in use produces a clear error (not a hang or crash)

### Environment variables

21. `KLOVI_HOST` overrides bind address
22. `KLOVI_PORT` overrides port
23. `KLOVI_STATIC_DIR` overrides web asset directory

### Graceful shutdown

24. `Ctrl+C` stops the server cleanly (no orphaned processes)

## Implementation steps

1. **Build all packages.** Run the workspace build from plan 24.

2. **Test under Node.** Run `node apps/package/dist/cli.js --no-browser` and walk through the Node checklist. Use `curl` or `fetch` to verify HTTP responses.

3. **Test under Bun.** Run `bun apps/package/dist/cli.js --no-browser` and walk through the Bun checklist.

4. **Test browser opening.** Run without `--no-browser` and verify the browser opens to the correct URL.

5. **Test environment overrides.** Set `KLOVI_PORT=4000` and verify the server binds to port 4000.

6. **Fix issues.** For each failure:
   - Identify root cause (import resolution, missing files, runtime detection, path resolution)
   - Fix in the appropriate package
   - Re-build and re-verify

7. **Simulate npm install.** Pack the package (`npm pack` or `bun pm pack`) and install from the tarball in a clean directory to verify the published artifact works in isolation.

## Acceptance criteria

- `node apps/package/dist/cli.js --no-browser` starts server, serves web UI, handles RPC
- `bun apps/package/dist/cli.js --no-browser` starts server, serves web UI, handles RPC
- Both runtimes auto-detect correctly
- SPA fallback works for client-side routes
- Environment variable overrides work
- Server shuts down cleanly on SIGINT
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run build` (workspace-level)
- Manual Node and Bun launch tests
