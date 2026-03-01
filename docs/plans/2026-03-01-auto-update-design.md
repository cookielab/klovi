# Auto-Update System Design

## Overview

Add automatic update checking, downloading, and installation to Klovi using the GitHub Releases API as the version source and adapting Electrobun's Updater extraction/apply logic for the install step.

## Decisions

- **Distribution:** GitHub Releases API for checking + downloading assets (no separate hosting infrastructure)
- **Updater approach:** Fork/adapt Electrobun Updater's extraction and apply logic to work with GitHub Release asset URLs directly
- **Channels:** stable (`X.Y.Z`), candidate (`X.Y.Z-rc.N`), beta (all including `X.Y.Z-beta.N`) — maps to existing CI tag patterns
- **Check timing:** On app startup + periodic interval (default 6 hours, configurable)
- **UX:** Auto-download in background, manual install via notification bar or settings
- **Downgrade policy:** No downgrade — switching from beta to stable just means next update will be a stable release

## Architecture

```
Main Process (Bun)
├── UpdateManager (src/bun/updater.ts)
│   ├── check()      → GitHub Releases API
│   ├── download()   → GitHub Release asset download
│   ├── apply()      → Extract + replace + relaunch
│   └── schedule()   → Periodic timer (setInterval)
├── Settings (src/bun/settings.ts)
│   └── updates: { channel, checkIntervalHours, autoDownload }
└── RPC handlers (src/bun/index.ts)
    ├── getUpdateSettings / updateUpdateSettings
    ├── checkForUpdate
    └── applyUpdate

Webview (React)
├── Settings > Updates tab
│   ├── Channel selector (stable / candidate / beta)
│   ├── Check interval dropdown (1h / 3h / 6h / 12h / 24h)
│   ├── Auto-download toggle
│   ├── Check now button
│   └── Status display
└── UpdateNotification bar (top of main view)
    └── "Klovi vX.Y.Z is ready — Restart to update" + Restart + Dismiss
```

## GitHub Releases Integration

**API endpoint:** `GET https://api.github.com/repos/cookielab/klovi/releases` (unauthenticated, 60 req/hr)

**Channel filtering:**

| Channel     | Includes                      | Filter                                            |
| ----------- | ----------------------------- | ------------------------------------------------- |
| `stable`    | Only `X.Y.Z`                 | `prerelease === false`                            |
| `candidate` | `X.Y.Z` + `X.Y.Z-rc.N`      | `prerelease === false` OR tag matches `-rc.`      |
| `beta`      | All releases                  | no filter                                         |

**Asset selection by platform:**

- macOS arm64: `Klovi-{version}-macos-arm64.zip`
- Linux amd64: `Klovi-{version}-linux-amd64.tar.gz`
- Linux arm64: `Klovi-{version}-linux-arm64.tar.gz`
- Windows amd64: `Klovi-{version}-windows-amd64.zip`
- Windows arm64: `Klovi-{version}-windows-arm64.zip`

**Rate limit protection:** Store `lastCheckTimestamp` in settings. Skip check if less than 5 minutes since last check.

## Download & Apply Flow

1. **Check** — Query GitHub API, compare versions via semver, find matching asset URL
2. **Download** — Fetch asset to `{userData}/updates/{version}/` temp directory with progress tracking
3. **Stage** — Extract archive (zip on macOS/Windows, tar.gz on Linux) to staging directory
4. **Notify** — Send `updateStatus` RPC message to webview: status=ready, version=X.Y.Z
5. **Apply** (user-triggered via "Restart" button or menu) — Platform-specific replacement:
   - **macOS:** Remove old `.app`, move new in place, clear quarantine xattr, relaunch via `open` (adapted from Electrobun Updater)
   - **Linux:** Replace `{appDataFolder}/app/` directory, chmod binaries, relaunch via launcher (adapted from Electrobun Updater)
   - **Windows:** Write batch script for post-exit replacement, schedule via Task Scheduler, quit app (adapted from Electrobun Updater)

**Error handling:**

- Network failure during check: silently retry at next interval
- Network failure during download: retry up to 3 times with exponential backoff, then show error in settings
- Corrupt download: verify file size matches Content-Length, delete and retry
- Apply failure: log error, show in settings, do not corrupt current install (staging directory used as buffer)

**Cleanup:** After successful apply + relaunch, delete old downloads from `{userData}/updates/`. On startup, clean stale staging directories.

## Settings Schema Extension

```ts
type PluginSettings = {
  version: 1;
  plugins: { ... };
  general?: { showSecurityWarning?: boolean };
  updates?: {
    channel: "stable" | "candidate" | "beta";  // default: "stable"
    checkIntervalHours: number;                  // default: 6
    autoDownload: boolean;                       // default: true
  };
};
```

## RPC Contract

```ts
// Requests (webview → main)
getUpdateSettings(): { channel: string; checkIntervalHours: number; autoDownload: boolean }
updateUpdateSettings(settings: Partial<UpdateSettings>): void
checkForUpdate(): {
  status: "up-to-date" | "available" | "downloading" | "ready" | "error";
  currentVersion: string;
  latestVersion?: string;
  error?: string;
}
applyUpdate(): void  // triggers quit + replace + relaunch

// Messages (main → webview)
updateStatus: {
  status: "checking" | "available" | "downloading" | "ready" | "error";
  version?: string;
  progress?: number;  // 0-100 for download
  error?: string;
}
```

## Menu Integration

Add "Check for Updates..." item to the Klovi application menu (standard macOS convention).

## Frontend UI

**Settings > Updates tab:**

- Current version display
- Update channel dropdown: Stable / Release Candidate / Beta
- Check interval dropdown: 1h / 3h / 6h / 12h / 24h
- Auto-download toggle
- "Check now" button
- Status line: "Up to date" / "Downloading v2.1.0 (45%)" / "v2.1.0 ready to install" / error

**Update notification bar** (top of main app view when update ready):

- Thin bar: "Klovi v2.1.0 is ready — Restart to update"
- Restart button + Dismiss (×) button
- Dismissed = hidden until next launch or different version available
- Uses existing RPC message subscription pattern

## Files to Create/Modify

**New files:**

- `src/bun/updater.ts` — UpdateManager module
- `src/bun/__tests__/updater.test.ts` — unit + integration tests
- `src/frontend/components/settings/UpdatesTab.tsx` — settings UI
- `src/frontend/components/UpdateNotification.tsx` — notification bar

**Modified files:**

- `src/bun/settings.ts` — extend schema with `updates` field
- `src/bun/index.ts` — wire RPC handlers, schedule checks, add menu item
- `src/shared/rpc-types.ts` — add update RPC methods and messages
- `src/frontend/components/settings/SettingsView.tsx` — add Updates tab

## Testing Strategy

**Unit tests:**

- Version comparison (semver ordering, stable > rc > beta)
- Channel filtering (correct releases selected per channel)
- Asset name resolution (correct filename per platform/arch)
- Settings persistence (channel changes saved, defaults applied)

**Integration tests (mocked fetch):**

- Check flow: mock GitHub API response, verify correct version identified
- Error scenarios: network failure, malformed response, missing assets
- Download progress tracking

**RPC tests (existing setupMockRPC pattern):**

- Update settings read/write round-trip
- checkForUpdate returns correct status shapes
- updateStatus messages dispatched to webview

**Manual testing required for apply step** (filesystem replacement + process restart).
