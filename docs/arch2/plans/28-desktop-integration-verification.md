# Desktop Integration Verification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify that the desktop app works correctly after the server restructuring (plans 20-27), and fix any issues found.

**Architecture:** The desktop app (`apps/desktop`) starts an embedded server via `startKloviServer()`, loads the web UI in an Electrobun webview via `views://` protocol, and connects to the server over HTTP. The restructuring changed the server's package name, removed static serving from the server, and reorganized exports. This verification ensures the full desktop flow still works.

**Depends on:** Plans 13, 24, 25, 26, 27

---

## Verification checklist

### Build verification

1. `bun run build` in `apps/desktop` succeeds (Electrobun build)
2. No TypeScript errors in `apps/desktop` (`bun run typecheck` in desktop)
3. All desktop tests pass (`bun test` in desktop)

### Server startup

4. Desktop launches and `startKloviServer({ mode: "embedded", port: 0 })` returns a valid URL
5. The ephemeral port is captured and passed to the webview via `getServerUrl` RPC

### Webview loading

6. Webview loads `views://main/index.html` successfully
7. `mountKloviApp()` is called with the HTTP client pointed at the embedded server
8. The app renders without errors in the webview console

### RPC functionality

9. `POST /api/rpc/getVersion` to the embedded server returns version info
10. `POST /api/rpc/getProjects` returns project data (or empty array if no sessions exist)
11. `POST /api/rpc/getPluginSettings` returns plugin settings
12. `POST /api/rpc/getStats` returns dashboard stats

### Native features

13. `browseDirectory` opens a native file dialog
14. Theme toggle from menu sends `cycleTheme` message to webview
15. Update check menu action triggers update flow
16. `openExternal` opens URLs in system browser

### Server lifecycle

17. Closing the desktop window calls `server.stop()`
18. The server process does not leak after the app exits

## Implementation steps

1. **Build the desktop app.** Run the Electrobun build and fix any import/resolution errors from the restructured packages.

2. **Launch in dev mode.** Run `bun run dev` in `apps/desktop` and observe startup. Check terminal for server startup logs and errors.

3. **Manual smoke test.** Walk through the verification checklist above. Document any failures.

4. **Fix issues.** For each failure:
   - Identify the root cause (likely import path changes, missing exports, or dependency resolution)
   - Fix in the appropriate package
   - Re-verify

5. **Run automated tests.** `bun test` in `apps/desktop` and at workspace root.

## Acceptance criteria

- Desktop app builds without errors
- Desktop app launches, starts embedded server, loads webview, renders UI
- RPC calls from webview to embedded server work
- Native features (directory browse, menu actions, updates, open external) function
- Server shuts down cleanly when the app closes
- `bun run check`, `bun run typecheck`, `bun test` all pass

## Verification

- `bun run check`
- `bun run typecheck`
- `bun test`
- `bun run build` in `apps/desktop`
- Manual launch and smoke test
