# Electrobun Patches & Custom Wrappers

Klovi customizes Electrobun v1.16.0 in three layers:

1. **Declarative patch** applied at install time via `patchedDependencies` in `package.json` — modifies files inside `node_modules/electrobun/`.
2. **Runtime shims and binary patches** applied by `apps/desktop/scripts/run-electrobun-cli.ts` before each CLI invocation (build / dev).
3. **Custom wrappers** that replace or extend Electrobun features where patching isn't sufficient.

---

## Declarative Patch (`patches/electrobun@1.16.0.patch`)

### 1. `// @ts-nocheck` on internal modules

**Files:** `dist/api/bun/index.ts`, `ApplicationMenu.ts`, `BrowserView.ts`, `BrowserWindow.ts`, `ContextMenu.ts`, `Socket.ts`, `Tray.ts`, `Updater.ts`, `Utils.ts`, `proc/native.ts`

**What:** Adds `// @ts-nocheck` as the first line of each file.

**Why:** Electrobun's distributed TypeScript sources contain type errors that surface when Klovi enables `strict` mode and `noUncheckedIndexedAccess`. Since we consume these files as-is (Electrobun ships `.ts`, not `.js`), the only way to suppress the errors without forking is `@ts-nocheck`.

---

### 2. Absolute path resolution (replace `process.cwd()` / relative paths with `process.execPath`)

**Files:** `Paths.ts`, `BuildConfig.ts`, `Updater.ts`, `Utils.ts`, `proc/native.ts`, `dist/main.js`

**What:** Every place Electrobun resolves resource paths relative to `process.cwd()` or with bare relative literals (e.g. `../Resources/`) is changed to resolve relative to `dirname(process.execPath)`.

| File | Before | After |
|---|---|---|
| `Paths.ts` | `resolve("../Resources/")` | `resolve(dirname(process.execPath), "../Resources/")` |
| `BuildConfig.ts` | `` `../${resourcesDir}/build.json` `` | `join(dirname(process.execPath), "..", resourcesDir, "build.json")` |
| `Updater.ts` | `` `../${resourcesDir}/version.json` `` | `join(dirname(process.execPath), "..", resourcesDir, "version.json")` |
| `Utils.ts` | `join("..", resourcesDir, "version.json")` | `join(dirname(process.execPath), "..", resourcesDir, "version.json")` |
| `proc/native.ts` | `` join(process.cwd(), `libNativeWrapper.${suffix}`) `` | `` join(dirname(process.execPath), `libNativeWrapper.${suffix}`) `` |
| `dist/main.js` | `dirname(process.argv0)` | `dirname(process.execPath)` |

**Why:** On some platforms (notably Windows shortcuts and certain Linux launchers) the working directory is not set to the application bundle's `MacOS`/`bin` directory. When Electrobun uses `process.cwd()` or relative paths, resource lookups fail silently or crash. `process.execPath` always points to the actual Bun binary inside the bundle, making the resolution reliable regardless of how the app was launched.

---

### 3. BrowserView lifecycle management (disposal & frame resizing)

**File:** `BrowserView.ts`

**What:**
- Adds a `disposed` flag to guard against double-disposal.
- Adds `setFrame()` — calls the native `resizeWebview` symbol to resize a webview in-place.
- Refactors `remove()` into a shared `cleanup()` method with a `skipNativeRemove` option.
- Adds `disposeForWindowClose()` — cleans up JS state and sockets without calling `webviewRemove` on the native side (the native layer already destroyed the webview when the window closed).

```
cleanup({ skipNativeRemove }) →
  1. Set disposed = true
  2. Close the RPC socket (disposeWebviewSocket)
  3. Call native webviewRemove (unless skipNativeRemove)
  4. Null out ptr, delete from BrowserViewMap

disposeForWindowClose() → cleanup({ skipNativeRemove: true })
remove()               → cleanup()
```

**Why:** On Linux, when a window closes, the native layer destroys the webview automatically. Calling `webviewRemove` on an already-destroyed pointer causes a segfault. The `disposeForWindowClose` path avoids the native call while still cleaning up JS-side resources (sockets, maps, references).

---

### 4. Socket cleanup on webview disposal

**File:** `Socket.ts`

**What:** Exports a new `disposeWebviewSocket(webviewId)` function that closes the RPC WebSocket for a given webview and removes it from the internal `socketMap`.

```ts
export const disposeWebviewSocket = (webviewId: number): void => {
  const socketState = socketMap[webviewId];
  if (!socketState) return;
  try { socketState.socket?.close(); } catch (_) {}
  delete socketMap[webviewId];
};
```

**Why:** Without explicit socket cleanup, disposed webviews leave orphaned WebSocket connections. Over time (or during rapid open/close cycles) this leaks file descriptors and can cause "too many open files" errors.

---

### 5. Window resize forwarding to webview (Linux)

**File:** `BrowserWindow.ts`

**What:** Adds a `resize` event listener that updates `window.frame` and, on Linux only, calls `webview.setFrame()` to match the new window dimensions.

**Why:** On macOS and Windows, the native layer automatically resizes the webview when the window resizes. On Linux with the native (WebKitGTK) renderer, this doesn't happen — the webview retains its original size, leaving blank space or clipping content. This listener bridges the gap.

---

### 6. Window close uses `disposeForWindowClose` instead of `remove`

**File:** `BrowserWindow.ts`

**What:** In the `close` event handler, changes `view.remove()` to `view.disposeForWindowClose()`.

**Why:** See patch #3 — avoids calling the native `webviewRemove` on an already-destroyed pointer during window close.

---

### 7. macOS DMG creation retry logic

**File:** `src/cli/index.ts`

**What:** Adds `execSyncWithRetries()` — wraps `execSync` with up to 3 retries and linear backoff (1s, 2s, 3s) when the error contains "Resource busy". The `hdiutil create` call for DMG packaging now uses this wrapper.

**Why:** macOS's `hdiutil` intermittently fails with "Resource busy" when the volume or disk image file is temporarily locked by Spotlight indexing, antivirus scanners, or the OS itself. This causes non-deterministic CI failures. Retrying with backoff resolves the transient condition without masking real errors.

---

### 8. Linux `.desktop` file improvements

**File:** `src/cli/index.ts`

**What:**
1. Adds `X-GNOME-WMClass=${config.app.name}` to the generated `.desktop` file.
2. Changes the filename from `${config.app.name}.desktop` to `${config.app.identifier}.desktop`.

**Why:**
- `X-GNOME-WMClass` is the legacy GNOME property for matching a `.desktop` file to its window. Some desktop environments and versions still check it in addition to `StartupWMClass`. Without it, the app may appear as an unidentified window in the taskbar.
- Using `config.app.identifier` (e.g. `io.cookielab.klovi`) instead of `config.app.name` (e.g. `Klovi`) for the filename follows freedesktop conventions and prevents collisions when multiple apps share a display name.

---

## Runtime Patches (`apps/desktop/scripts/run-electrobun-cli.ts`)

This script runs before every `electrobun` CLI invocation (dev and build). It performs three additional patches that cannot be expressed as static diffs.

### 9. Source shims

**What:** Writes replacement files into `node_modules/electrobun/src/shared/` and `src/cli/templates/`:

| Shim file | Purpose |
|---|---|
| `src/shared/platform.ts` | Platform/architecture detection (`OS`, `ARCH` exports) |
| `src/shared/naming.ts` | App naming conventions (sanitize, bundle names, DMG volume names, update URLs) |
| `src/shared/bun-version.ts` | Hardcoded `BUN_VERSION` constant |
| `src/shared/electrobun-version.ts` | Reads version from `package.json` |
| `src/shared/cef-version.ts` | CEF and Chromium version constants |
| `src/cli/templates/embedded.ts` | Stub template registry (Klovi doesn't use Electrobun's project templates) |

**Why:** Electrobun's CLI imports these shared modules at build time. The upstream versions either don't exist yet in the distributed package, contain hardcoded values that don't match Klovi's setup, or include code that fails to compile under Klovi's stricter TypeScript config. Writing shims is simpler and less fragile than patching deeply intertwined CLI source files.

---

### 10. Native library WM class binary patch (Linux only)

**What:** Scans `libNativeWrapper.so` and `libNativeWrapper_cef.so` for the byte sequence `"ElectrobunKitchenSink-dev"` and overwrites it in-place with `"Klovi"` (padded with null bytes to preserve binary layout).

**Why:** The native wrapper libraries have a hardcoded WM class string compiled into the binary. On Linux, this string is what the window manager uses to identify the application. Without this patch, the app window reports itself as "ElectrobunKitchenSink-dev", which means:
- The taskbar shows the wrong name/icon.
- The `.desktop` file's `StartupWMClass` doesn't match, so the window and launcher entry appear as separate items.
- GNOME's window grouping and Alt-Tab behavior break.

---

### 11. Dev `.desktop` entry installation (Linux only)

**What:** Writes `~/.local/share/applications/io.cookielab.klovi.desktop` pointing to the dev build's launcher and icon. The entry has `NoDisplay=true` so it doesn't appear in application menus but is still discoverable by the window manager.

**Why:** Linux window managers match running windows to `.desktop` files for icon resolution and window grouping. Without a `.desktop` file installed, the dev build shows a generic icon and can't be pinned to the taskbar. The `NoDisplay=true` flag keeps it out of application launchers since it's only useful for development.

---

## Custom Wrappers

These are Klovi-owned modules that replace or extend Electrobun features where patching isn't sufficient. Unlike the patches above, these live in the Klovi source tree, not inside `node_modules/`.

### 12. Custom update system (`apps/desktop/src/bun/updater.ts`)

**What:** A complete `UpdateManager` class that replaces Electrobun's built-in `Updater`. It implements the full update lifecycle:

1. **Check** — fetches releases from the GitHub API, filters by channel (stable/candidate/beta), validates `update.json` metadata (version, platform, arch, hash).
2. **Download** — streams the `.tar.zst` bundle with progress reporting, retries up to 3 times with exponential backoff, decompresses via the bundled `zig-zstd` binary.
3. **Apply** — platform-specific installation:
   - **macOS**: Atomic app bundle swap (`rename` old to `.bak`, `rename` new into place), removes quarantine xattr, spawns a detached shell that waits for the process to exit then re-launches via `open`.
   - **Linux**: Replaces the app directory under `~/.klovi/app`, fixes `chmod +x` on launcher and bun binaries, spawns the new launcher as a detached process.
   - **Windows**: Writes a `update.bat` script that waits for the current process to exit, swaps directories, and re-launches. Scheduled via `schtasks` to survive the parent process exit.
4. **Schedule** — periodic background checks at a configurable interval (default 6 hours), with a 5-minute cooldown between manual checks.

**Why:** Electrobun's built-in updater doesn't support GitHub releases as an update source, doesn't provide download progress, and doesn't handle the platform-specific restart choreography Klovi needs. A custom implementation gives full control over channel filtering, metadata validation, and the apply-and-restart sequence.

**Key exports:** `UpdateManager`, `filterReleasesByChannel()`, `findLatestUsableRelease()`, `validateUpdateInfo()`, `getZstdBinaryPath()`, `getReleaseBundleAssetName()`.

---

### 13. Linux runtime abstraction (`apps/desktop/src/bun/linux-runtime.ts`)

**What:** Three utility functions that isolate Linux-specific Electrobun initialization:

- `resolveLinuxRenderer(platform, env)` — returns `"native"` or `"cef"` based on the `KLOVI_LINUX_RENDERER` environment variable (defaults to `"native"`).
- `getDesktopRuntimeDirs(paths)` — returns the list of directories that must exist for Electrobun to run (userData, userCache, userLogs, CEF partition directories).
- `ensureDesktopRuntimeDirs(paths)` — creates all required directories recursively.

**Why:** Electrobun on Linux requires certain directories to exist before the native layer initializes, but doesn't create them itself. The renderer choice also needs to be explicit (native WebKitGTK vs CEF) because auto-detection isn't reliable across Linux distributions. Extracting this into a dedicated module keeps the main process entry point clean and makes the logic testable.

---

### 14. Webview RPC client with resilient transport (`apps/desktop/src/views/main/index.ts`)

**What:** A custom wrapper around Electrobun's `Electroview` RPC that adds:

- **Connection state machine** — tracks `connecting | connected | disconnected` and notifies listeners on transitions.
- **Exponential backoff reconnection** — on socket close/error, reconnects with delays doubling from 1s up to 30s max. Resets to 1s on successful reconnect.
- **Per-method timeouts** — data-heavy queries (`getProjects`, `getSessions`, `searchSessions`, `getStats`) get 120s, session detail queries get 60s, all others default to 30s. Electrobun's default infinite timeout is overridden.
- **Connection-aware RPC calls** — `callDesktopRpc()` waits up to 5s for a connection before throwing `RpcDisconnectedError`. On transport errors, it marks the connection as disconnected and triggers reconnect.
- **Menu action forwarding** — incoming Electrobun RPC messages (`cycleTheme`, `increaseFontSize`, etc.) are dispatched to a `Set<callback>` so any number of UI components can subscribe.
- **`KloviHostBridge` implementation** — bridges the platform-agnostic `KloviHostBridge` interface to desktop-specific RPC calls (file dialogs, updater control, external link opening, menu/update/connection subscriptions).

**Why:** Electrobun's raw `Electroview` has no reconnection logic — if the WebSocket drops (e.g. the main process restarts during development, or a transient IPC failure), the webview becomes permanently unresponsive. The timeout system prevents the UI from hanging indefinitely on slow queries. The `KloviHostBridge` abstraction allows the same UI code to work with different host implementations (desktop via RPC, future web/server via HTTP).

---

### 15. Electrobun RPC adapter (`apps/desktop/src/shared/rpc-types.ts`)

**What:** Defines the `KloviRPC` interface that adapts Klovi's transport-neutral
desktop contract to Electrobun's `RPCSchema`.

The source-of-truth request/message definitions now live in
`packages/ui/src/shared/desktop-contract.ts`:

- **`DesktopRequestMap`**: desktop host requests plus the transport-neutral
  `KloviClient` request surface.
- **`DesktopWebviewMessageMap`**: menu actions, update notifications, and theme
  change messages sent back into the renderer.
- **Shared types**: `UpdateChannel`, `UpdateSettingsInfo`, `UpdateStatus` stay
  in `packages/ui/src/shared/rpc-types.ts`.

**Why:** Electrobun's RPC is typed via `RPCSchema`, but the application contract
should not be locked to Electrobun. Moving the request/message maps into
`packages/ui` makes the contract reusable for a future Electron preload/main IPC
adapter while keeping the current Electrobun implementation type-safe.

---

### 16. Build verification scripts (`apps/desktop/scripts/verify-*.ts`)

**What:** Post-build scripts that validate Electrobun-produced bundles are correct:

| Script | What it verifies |
|---|---|
| `verify-linux-wrapper-contract.ts` | Linux bundle structure: metadata.json, .desktop entry, icons, launcher permissions |
| `verify-linux-window-identity.ts` | Launches the app and checks that `WM_CLASS` reports "Klovi" (not "ElectrobunKitchenSink-dev") |
| `verify-macos-wrapper-contract.ts` | macOS bundle structure: Info.plist, embedded tarball, code signature validity |
| `verify-updater-artifact.ts` | Update artifacts: tarball contents, update.json metadata, hash integrity |

Each script has a companion `.test.ts` that unit-tests its validation logic.

**Why:** Electrobun's build output is a complex platform-specific bundle. The patches and shims above modify the build pipeline, so any regression could produce a bundle that looks fine but fails at runtime (wrong WM class, missing launcher, invalid metadata). These scripts run in CI to catch issues before distribution.

---

## Summary

| # | Category | Platform | Type |
|---|---|---|---|
| 1 | TypeScript suppression | All | Declarative patch |
| 2 | Path resolution | All (critical on Windows/Linux) | Declarative patch |
| 3 | BrowserView lifecycle | Linux | Declarative patch |
| 4 | Socket cleanup | All | Declarative patch |
| 5 | Window resize forwarding | Linux | Declarative patch |
| 6 | Window close disposal | Linux | Declarative patch |
| 7 | DMG retry logic | macOS | Declarative patch |
| 8 | `.desktop` file improvements | Linux | Declarative patch |
| 9 | Source shims | All (build-time) | Runtime patch |
| 10 | WM class binary patch | Linux | Runtime patch |
| 11 | Dev `.desktop` entry | Linux | Runtime patch |
| 12 | Custom update system | All | Custom wrapper |
| 13 | Linux runtime abstraction | Linux | Custom wrapper |
| 14 | Resilient RPC transport | All | Custom wrapper |
| 15 | Typed RPC schema | All | Custom wrapper |
| 16 | Build verification | macOS/Linux | Custom wrapper |
