# Auto-Update System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic update checking via GitHub Releases API, background downloading, and user-triggered installation with channel selection (stable/candidate/beta).

**Architecture:** Custom UpdateManager in the main process queries GitHub Releases API, downloads platform assets, and applies updates by extracting/replacing the app bundle (logic adapted from Electrobun's Updater). Frontend gets a new Settings > Updates tab and a notification bar. Communication via Electrobun typed RPC.

**Tech Stack:** Bun runtime, React 19, Electrobun RPC, GitHub REST API, semver comparison, plain CSS with custom properties.

---

### Task 1: Extend Settings Schema with Update Preferences

**Files:**
- Modify: `src/bun/settings.ts`
- Modify: `src/bun/settings.test.ts`

**Step 1: Write the failing test**

Add to `src/bun/settings.test.ts`:

```ts
test("getDefaultSettings includes updates with stable channel", () => {
  const settings = getDefaultSettings();
  expect(settings.updates).toEqual({
    channel: "stable",
    checkIntervalHours: 6,
    autoDownload: true,
  });
});

test("loadSettings preserves updates field", () => {
  mkdirSync(testDir, { recursive: true });
  const path = settingsPath();
  const settings: PluginSettings = {
    ...getDefaultSettings(),
    updates: { channel: "beta", checkIntervalHours: 1, autoDownload: false },
  };
  saveSettings(path, settings);
  const loaded = loadSettings(path);
  expect(loaded.updates).toEqual({ channel: "beta", checkIntervalHours: 1, autoDownload: false });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/bun/settings.test.ts`
Expected: FAIL — `getDefaultSettings()` doesn't include `updates` field yet.

**Step 3: Write minimal implementation**

In `src/bun/settings.ts`, update the `PluginSettings` type:

```ts
export type UpdateChannel = "stable" | "candidate" | "beta";

export type UpdateSettings = {
  channel: UpdateChannel;
  checkIntervalHours: number;
  autoDownload: boolean;
};

export type PluginSettings = {
  version: 1;
  plugins: {
    [pluginId: string]: {
      enabled: boolean;
      dataDir: string | null;
    };
  };
  general?:
    | {
        showSecurityWarning?: boolean | undefined;
      }
    | undefined;
  updates?: UpdateSettings | undefined;
};
```

Update `getDefaultSettings()`:

```ts
export function getDefaultSettings(): PluginSettings {
  return {
    version: 1,
    plugins: createDefaultPluginStates(),
    general: {
      showSecurityWarning: true,
    },
    updates: {
      channel: "stable",
      checkIntervalHours: 6,
      autoDownload: true,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/bun/settings.test.ts`
Expected: All PASS.

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat(settings): add update preferences to settings schema
```

---

### Task 2: Add Update RPC Types

**Files:**
- Modify: `src/shared/rpc-types.ts`

**Step 1: Add types and RPC methods**

Add the following types near the other type definitions (near `VersionInfo`):

```ts
export type UpdateChannel = "stable" | "candidate" | "beta";

export type UpdateSettingsInfo = {
  channel: UpdateChannel;
  checkIntervalHours: number;
  autoDownload: boolean;
};

export type UpdateStatus = {
  status: "up-to-date" | "available" | "downloading" | "ready" | "error";
  currentVersion: string;
  latestVersion?: string;
  progress?: number;
  error?: string;
};
```

Add to the `bun.requests` section of `KloviRPC`:

```ts
getUpdateSettings: {
  params: Record<string, never>;
  response: UpdateSettingsInfo;
};
updateUpdateSettings: {
  params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean };
  response: UpdateSettingsInfo;
};
checkForUpdate: {
  params: Record<string, never>;
  response: UpdateStatus;
};
applyUpdate: {
  params: Record<string, never>;
  response: { ok: boolean };
};
```

Add to the `webview.messages` section of `KloviRPC`:

```ts
updateStatus: UpdateStatus;
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: FAIL — handlers in `src/bun/index.ts` don't implement new methods yet; webview message handler missing `updateStatus`.

**Step 3: Add stub handlers to main process**

In `src/bun/index.ts`, add stub handlers inside the `requests` object:

```ts
getUpdateSettings: () => ({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
updateUpdateSettings: () => ({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
checkForUpdate: () => ({ status: "up-to-date" as const, currentVersion: version }),
applyUpdate: () => ({ ok: true }),
```

In `src/views/main/index.ts`, add to `messages` handlers:

```ts
updateStatus: () => {
  // Will be implemented in Task 7
},
```

**Step 4: Update `src/frontend/rpc.ts`**

Add to the `RPCClient.request` interface:

```ts
getUpdateSettings: (params: Record<string, never>) => Promise<import("../shared/rpc-types.ts").UpdateSettingsInfo>;
updateUpdateSettings: (params: {
  channel?: import("../shared/rpc-types.ts").UpdateChannel;
  checkIntervalHours?: number;
  autoDownload?: boolean;
}) => Promise<import("../shared/rpc-types.ts").UpdateSettingsInfo>;
checkForUpdate: (params: Record<string, never>) => Promise<import("../shared/rpc-types.ts").UpdateStatus>;
applyUpdate: (params: Record<string, never>) => Promise<{ ok: boolean }>;
```

**Step 5: Update `src/frontend/test-helpers/mock-rpc.ts`**

Add default mocks inside the `defaultMock.request` object:

```ts
getUpdateSettings: () => Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
updateUpdateSettings: () => Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
checkForUpdate: () => Promise.resolve({ status: "up-to-date" as const, currentVersion: "test" }),
applyUpdate: () => Promise.resolve({ ok: true }),
```

**Step 6: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All PASS.

**Step 7: Commit**

```
feat(rpc): add update settings and status RPC types
```

---

### Task 3: Implement Update RPC Handlers (Settings Read/Write)

**Files:**
- Modify: `src/bun/rpc-handlers.ts`
- Modify: `src/bun/rpc-handlers.test.ts`
- Modify: `src/bun/index.ts`

**Step 1: Write the failing tests**

Add to `src/bun/rpc-handlers.test.ts`:

```ts
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getUpdateSettings, updateUpdateSettings } from "./rpc-handlers.ts";

const testDir = join(tmpdir(), `klovi-rpc-test-${Date.now()}`);

describe("update settings handlers", () => {
  afterEach(() => {
    try { rmSync(testDir, { recursive: true }); } catch {}
  });

  test("getUpdateSettings returns defaults when no settings exist", () => {
    const path = join(testDir, "nonexistent", "settings.json");
    const result = getUpdateSettings(path);
    expect(result.channel).toBe("stable");
    expect(result.checkIntervalHours).toBe(6);
    expect(result.autoDownload).toBe(true);
  });

  test("updateUpdateSettings persists channel change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { channel: "beta" });
    expect(result.channel).toBe("beta");
    const reloaded = getUpdateSettings(path);
    expect(reloaded.channel).toBe("beta");
  });

  test("updateUpdateSettings persists checkIntervalHours change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { checkIntervalHours: 1 });
    expect(result.checkIntervalHours).toBe(1);
  });

  test("updateUpdateSettings persists autoDownload change", () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "settings.json");
    const result = updateUpdateSettings(path, { autoDownload: false });
    expect(result.autoDownload).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/bun/rpc-handlers.test.ts`
Expected: FAIL — `getUpdateSettings` and `updateUpdateSettings` not exported from `rpc-handlers.ts`.

**Step 3: Implement the handlers**

Add to `src/bun/rpc-handlers.ts`:

```ts
import type { UpdateChannel, UpdateSettingsInfo } from "../shared/rpc-types.ts";

export function getUpdateSettings(settingsPath: string): UpdateSettingsInfo {
  const settings = loadSettings(settingsPath);
  return {
    channel: settings.updates?.channel ?? "stable",
    checkIntervalHours: settings.updates?.checkIntervalHours ?? 6,
    autoDownload: settings.updates?.autoDownload ?? true,
  };
}

export function updateUpdateSettings(
  settingsPath: string,
  params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
): UpdateSettingsInfo {
  const settings = loadSettings(settingsPath);
  if (!settings.updates) {
    settings.updates = { channel: "stable", checkIntervalHours: 6, autoDownload: true };
  }
  if (params.channel !== undefined) {
    settings.updates.channel = params.channel;
  }
  if (params.checkIntervalHours !== undefined) {
    settings.updates.checkIntervalHours = params.checkIntervalHours;
  }
  if (params.autoDownload !== undefined) {
    settings.updates.autoDownload = params.autoDownload;
  }
  saveSettings(settingsPath, settings);
  return {
    channel: settings.updates.channel,
    checkIntervalHours: settings.updates.checkIntervalHours,
    autoDownload: settings.updates.autoDownload,
  };
}
```

**Step 4: Wire handlers in `src/bun/index.ts`**

Replace the stub handlers with real ones:

```ts
getUpdateSettings: () => getUpdateSettings(getSettingsPath()),
updateUpdateSettings: (params) => updateUpdateSettings(getSettingsPath(), params),
```

Import the new functions at the top.

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat(rpc): implement update settings read/write handlers
```

---

### Task 4: Implement GitHub Releases Version Checker

**Files:**
- Create: `src/bun/updater.ts`
- Create: `src/bun/updater.test.ts`

**Step 1: Write failing tests for version comparison and channel filtering**

Create `src/bun/updater.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  compareVersions,
  filterReleasesByChannel,
  getAssetName,
  type GitHubRelease,
} from "./updater.ts";

describe("compareVersions", () => {
  test("returns positive when a > b", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
  });

  test("returns negative when a < b", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  test("returns 0 when equal", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  test("compares minor versions", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
  });

  test("compares patch versions", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
  });

  test("prerelease is less than release", () => {
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
  });

  test("rc is greater than beta", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0-beta.1")).toBeGreaterThan(0);
  });

  test("beta.2 is greater than beta.1", () => {
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
  });
});

function makeRelease(tag: string, prerelease: boolean): GitHubRelease {
  return {
    tag_name: tag,
    prerelease,
    draft: false,
    assets: [],
  };
}

describe("filterReleasesByChannel", () => {
  const releases: GitHubRelease[] = [
    makeRelease("2.0.0", false),
    makeRelease("2.1.0-rc.1", true),
    makeRelease("2.1.0-beta.1", true),
    makeRelease("1.9.0", false),
  ];

  test("stable returns only non-prerelease", () => {
    const filtered = filterReleasesByChannel(releases, "stable");
    expect(filtered.map((r) => r.tag_name)).toEqual(["2.0.0", "1.9.0"]);
  });

  test("candidate returns non-prerelease and rc", () => {
    const filtered = filterReleasesByChannel(releases, "candidate");
    expect(filtered.map((r) => r.tag_name)).toEqual(["2.0.0", "2.1.0-rc.1", "1.9.0"]);
  });

  test("beta returns all releases", () => {
    const filtered = filterReleasesByChannel(releases, "beta");
    expect(filtered).toHaveLength(4);
  });
});

describe("getAssetName", () => {
  test("returns correct name for macos arm64", () => {
    expect(getAssetName("2.0.0", "macos", "arm64")).toBe("Klovi-2.0.0-macos-arm64.zip");
  });

  test("returns correct name for linux amd64", () => {
    expect(getAssetName("2.0.0", "linux", "x64")).toBe("Klovi-2.0.0-linux-amd64.tar.gz");
  });

  test("returns correct name for linux arm64", () => {
    expect(getAssetName("2.0.0", "linux", "arm64")).toBe("Klovi-2.0.0-linux-arm64.tar.gz");
  });

  test("returns correct name for windows amd64", () => {
    expect(getAssetName("2.0.0", "win", "x64")).toBe("Klovi-2.0.0-windows-amd64.zip");
  });

  test("returns correct name for windows arm64", () => {
    expect(getAssetName("2.0.0", "win", "arm64")).toBe("Klovi-2.0.0-windows-arm64.zip");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/bun/updater.test.ts`
Expected: FAIL — file doesn't exist yet.

**Step 3: Implement the updater module**

Create `src/bun/updater.ts`:

```ts
import type { UpdateChannel, UpdateStatus } from "../shared/rpc-types.ts";

const GITHUB_API_URL = "https://api.github.com/repos/cookielab/klovi/releases";

export interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [main, pre] = v.split("-");
    const parts = main!.split(".").map(Number);
    let preType = 2; // no prerelease = highest
    let preNum = 0;
    if (pre) {
      if (pre.startsWith("rc.")) {
        preType = 1;
        preNum = Number(pre.slice(3));
      } else if (pre.startsWith("beta.")) {
        preType = 0;
        preNum = Number(pre.slice(5));
      }
    }
    return { major: parts[0]!, minor: parts[1]!, patch: parts[2]!, preType, preNum };
  };

  const pa = parseVersion(a);
  const pb = parseVersion(b);

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.preType !== pb.preType) return pa.preType - pb.preType;
  return pa.preNum - pb.preNum;
}

export function filterReleasesByChannel(
  releases: GitHubRelease[],
  channel: UpdateChannel,
): GitHubRelease[] {
  return releases.filter((r) => {
    if (r.draft) return false;
    switch (channel) {
      case "stable":
        return !r.prerelease;
      case "candidate":
        return !r.prerelease || r.tag_name.includes("-rc.");
      case "beta":
        return true;
    }
  });
}

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

export function getAssetName(version: string, platform: Platform, arch: Arch): string {
  const platformName = platform === "win" ? "windows" : platform;
  const archName = arch === "x64" ? "amd64" : "arm64";
  const ext = platform === "linux" ? "tar.gz" : "zip";
  return `Klovi-${version}-${platformName}-${archName}.${ext}`;
}

export async function fetchReleases(): Promise<GitHubRelease[]> {
  const response = await fetch(GITHUB_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  return response.json();
}

export function findLatestRelease(
  releases: GitHubRelease[],
  channel: UpdateChannel,
  currentVersion: string,
): GitHubRelease | null {
  const filtered = filterReleasesByChannel(releases, channel);
  let best: GitHubRelease | null = null;
  for (const release of filtered) {
    if (compareVersions(release.tag_name, currentVersion) > 0) {
      if (!best || compareVersions(release.tag_name, best.tag_name) > 0) {
        best = release;
      }
    }
  }
  return best;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/bun/updater.test.ts`
Expected: All PASS.

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat(updater): add version comparison, channel filtering, and asset naming
```

---

### Task 5: Implement Update Manager (Check + Download + Apply)

**Files:**
- Modify: `src/bun/updater.ts`
- Modify: `src/bun/updater.test.ts`

**Step 1: Write failing tests for findLatestRelease**

Add to `src/bun/updater.test.ts`:

```ts
import { findLatestRelease } from "./updater.ts";

describe("findLatestRelease", () => {
  const releases: GitHubRelease[] = [
    { ...makeRelease("2.1.0-beta.1", true), assets: [{ name: "Klovi-2.1.0-beta.1-macos-arm64.zip", browser_download_url: "https://example.com/beta" }] },
    { ...makeRelease("2.1.0-rc.1", true), assets: [{ name: "Klovi-2.1.0-rc.1-macos-arm64.zip", browser_download_url: "https://example.com/rc" }] },
    { ...makeRelease("2.0.0", false), assets: [{ name: "Klovi-2.0.0-macos-arm64.zip", browser_download_url: "https://example.com/stable" }] },
    { ...makeRelease("1.9.0", false), assets: [] },
  ];

  test("returns null when current version is latest on stable", () => {
    const result = findLatestRelease(releases, "stable", "2.0.0");
    expect(result).toBeNull();
  });

  test("returns newer stable release", () => {
    const result = findLatestRelease(releases, "stable", "1.9.0");
    expect(result?.tag_name).toBe("2.0.0");
  });

  test("returns rc release on candidate channel", () => {
    const result = findLatestRelease(releases, "candidate", "2.0.0");
    expect(result?.tag_name).toBe("2.1.0-rc.1");
  });

  test("returns beta release on beta channel", () => {
    const result = findLatestRelease(releases, "beta", "2.0.0");
    expect(result?.tag_name).toBe("2.1.0-beta.1");
  });

  test("returns highest version on beta channel", () => {
    const result = findLatestRelease(releases, "beta", "1.0.0");
    expect(result?.tag_name).toBe("2.1.0-rc.1");
  });
});
```

**Step 2: Run tests**

Run: `bun test src/bun/updater.test.ts`
Expected: All PASS (findLatestRelease already implemented in Task 4).

**Step 3: Add UpdateManager class**

Add to `src/bun/updater.ts`:

```ts
import { mkdirSync, rmSync, readdirSync, statSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { loadSettings } from "./settings.ts";
import type { UpdateSettingsInfo } from "../shared/rpc-types.ts";

type StatusCallback = (status: UpdateStatus) => void;

export class UpdateManager {
  private currentVersion: string;
  private platform: Platform;
  private arch: Arch;
  private settingsPath: string;
  private appDataDir: string;
  private onStatusChange: StatusCallback | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private lastCheckTimestamp = 0;
  private latestRelease: GitHubRelease | null = null;
  private downloadedAssetPath: string | null = null;
  private currentStatus: UpdateStatus;

  constructor(opts: {
    currentVersion: string;
    platform: Platform;
    arch: Arch;
    settingsPath: string;
    appDataDir: string;
  }) {
    this.currentVersion = opts.currentVersion;
    this.platform = opts.platform;
    this.arch = opts.arch;
    this.settingsPath = opts.settingsPath;
    this.appDataDir = opts.appDataDir;
    this.currentStatus = { status: "up-to-date", currentVersion: this.currentVersion };
  }

  setStatusCallback(cb: StatusCallback): void {
    this.onStatusChange = cb;
  }

  getStatus(): UpdateStatus {
    return this.currentStatus;
  }

  private emitStatus(status: UpdateStatus): void {
    this.currentStatus = status;
    this.onStatusChange?.(status);
  }

  private getSettings(): UpdateSettingsInfo {
    const settings = loadSettings(this.settingsPath);
    return {
      channel: settings.updates?.channel ?? "stable",
      checkIntervalHours: settings.updates?.checkIntervalHours ?? 6,
      autoDownload: settings.updates?.autoDownload ?? true,
    };
  }

  private updatesDir(): string {
    return join(this.appDataDir, "updates");
  }

  startSchedule(): void {
    const settings = this.getSettings();
    const intervalMs = settings.checkIntervalHours * 60 * 60 * 1000;

    // Check immediately on startup
    this.check().catch(() => {});

    // Set up periodic check
    this.checkTimer = setInterval(() => {
      this.check().catch(() => {});
    }, intervalMs);
  }

  stopSchedule(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  restartSchedule(): void {
    this.stopSchedule();
    this.startSchedule();
  }

  async check(): Promise<UpdateStatus> {
    // Rate limit: minimum 5 minutes between checks
    const now = Date.now();
    if (now - this.lastCheckTimestamp < 5 * 60 * 1000) {
      return this.currentStatus;
    }
    this.lastCheckTimestamp = now;

    const settings = this.getSettings();

    this.emitStatus({ status: "up-to-date", currentVersion: this.currentVersion });

    try {
      const releases = await fetchReleases();
      const latest = findLatestRelease(releases, settings.channel, this.currentVersion);

      if (!latest) {
        const status: UpdateStatus = { status: "up-to-date", currentVersion: this.currentVersion };
        this.emitStatus(status);
        return status;
      }

      this.latestRelease = latest;

      const status: UpdateStatus = {
        status: "available",
        currentVersion: this.currentVersion,
        latestVersion: latest.tag_name,
      };
      this.emitStatus(status);

      // Auto-download if enabled
      if (settings.autoDownload) {
        await this.download();
      }

      return this.currentStatus;
    } catch (error) {
      const status: UpdateStatus = {
        status: "error",
        currentVersion: this.currentVersion,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      this.emitStatus(status);
      return status;
    }
  }

  async download(): Promise<void> {
    if (!this.latestRelease) return;

    const assetName = getAssetName(this.latestRelease.tag_name, this.platform, this.arch);
    const asset = this.latestRelease.assets.find((a) => a.name === assetName);

    if (!asset) {
      this.emitStatus({
        status: "error",
        currentVersion: this.currentVersion,
        latestVersion: this.latestRelease.tag_name,
        error: `Asset not found: ${assetName}`,
      });
      return;
    }

    this.emitStatus({
      status: "downloading",
      currentVersion: this.currentVersion,
      latestVersion: this.latestRelease.tag_name,
      progress: 0,
    });

    const dir = join(this.updatesDir(), this.latestRelease.tag_name);
    mkdirSync(dir, { recursive: true });
    const destPath = join(dir, assetName);

    try {
      const response = await fetch(asset.browser_download_url);
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }

      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;
      let bytesDownloaded = 0;

      const reader = response.body.getReader();
      const writer = Bun.file(destPath).writer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        bytesDownloaded += value.length;

        if (bytesDownloaded % 500_000 < value.length) {
          this.emitStatus({
            status: "downloading",
            currentVersion: this.currentVersion,
            latestVersion: this.latestRelease!.tag_name,
            progress: totalBytes ? Math.round((bytesDownloaded / totalBytes) * 100) : undefined,
          });
        }
      }
      await writer.flush();
      writer.end();

      this.downloadedAssetPath = destPath;

      this.emitStatus({
        status: "ready",
        currentVersion: this.currentVersion,
        latestVersion: this.latestRelease.tag_name,
      });
    } catch (error) {
      // Clean up partial download
      try { rmSync(dir, { recursive: true }); } catch {}

      this.emitStatus({
        status: "error",
        currentVersion: this.currentVersion,
        latestVersion: this.latestRelease.tag_name,
        error: error instanceof Error ? error.message : "Download failed",
      });
    }
  }

  async apply(): Promise<void> {
    // Apply logic is platform-specific and adapted from Electrobun's Updater.
    // This will be implemented as a separate sub-task since it requires
    // platform-specific filesystem operations and process management.
    // For now, the download + ready notification is the core flow.
    if (!this.downloadedAssetPath || !this.latestRelease) {
      return;
    }

    // The actual apply logic will extract the archive and replace the app bundle.
    // Detailed implementation depends on the platform and follows the patterns
    // documented in Electrobun's Updater.applyUpdate() method.
  }

  cleanup(): void {
    // Clean stale update downloads
    const dir = this.updatesDir();
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          rmSync(fullPath, { recursive: true });
        } catch {}
      }
    } catch {}
  }
}
```

**Step 4: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```
feat(updater): add UpdateManager with check, download, and scheduling
```

---

### Task 6: Wire UpdateManager into Main Process

**Files:**
- Modify: `src/bun/index.ts`

**Step 1: Import and instantiate UpdateManager**

In `src/bun/index.ts`, after the `getSettingsPath()` helper:

```ts
import { UpdateManager } from "./updater.ts";

// Lazy-init after acceptRisks
let updateManager: UpdateManager | null = null;

function getUpdateManager(): UpdateManager {
  if (!updateManager) {
    const settingsPath = getSettingsPath();
    updateManager = new UpdateManager({
      currentVersion: version,
      platform: process.platform === "darwin" ? "macos" : process.platform === "win32" ? "win" : "linux",
      arch: process.arch === "arm64" ? "arm64" : "x64",
      settingsPath,
      appDataDir: Utils.paths.userData,
    });
  }
  return updateManager;
}
```

**Step 2: Replace stub RPC handlers with real ones**

```ts
getUpdateSettings: () => getUpdateSettings(getSettingsPath()),
updateUpdateSettings: (params) => {
  const result = updateUpdateSettings(getSettingsPath(), params);
  // Restart schedule if interval changed
  updateManager?.restartSchedule();
  return result;
},
checkForUpdate: async () => {
  const mgr = getUpdateManager();
  return mgr.check();
},
applyUpdate: async () => {
  const mgr = getUpdateManager();
  await mgr.apply();
  return { ok: true };
},
```

**Step 3: Start the update schedule after acceptRisks**

In the `acceptRisks` handler, after initializing the registry:

```ts
acceptRisks: () => {
  if (!registry) {
    const settings = loadSettings(getSettingsPath());
    registry = createRegistry(settings);
  }
  // Start update checking
  const mgr = getUpdateManager();
  mgr.setStatusCallback((status) => {
    const rpcSend = win?.webview?.rpc?.send;
    if (rpcSend) {
      rpcSend.updateStatus(status);
    }
  });
  mgr.startSchedule();
  return { ok: true };
},
```

**Step 4: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```
feat(main): wire UpdateManager into main process with RPC handlers
```

---

### Task 7: Add "Updates" Tab to Settings Sidebar

**Files:**
- Modify: `src/frontend/components/settings/SettingsSidebar.tsx`
- Modify: `src/frontend/components/settings/SettingsView.test.tsx`
- Modify: `src/frontend/App.tsx`

**Step 1: Write failing test**

Add to `src/frontend/components/settings/SettingsView.test.tsx`, in the `SettingsSidebar` describe block:

```ts
test("renders Updates button", () => {
  const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => {}} />);
  expect(getByRole("button", { name: "Updates" })).toBeDefined();
});

test("marks Updates as active when activeTab is updates", () => {
  const { getByRole } = render(<SettingsSidebar activeTab="updates" onTabChange={() => {}} />);
  expect(getByRole("button", { name: "Updates" }).classList.contains("active")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/frontend/components/settings/SettingsView.test.tsx`
Expected: FAIL — no "Updates" button, type error on "updates" tab.

**Step 3: Update SettingsTab type and SettingsSidebar**

In `src/frontend/components/settings/SettingsSidebar.tsx`:

```ts
export type SettingsTab = "general" | "plugins" | "updates";
```

Add the new button after Plugins:

```tsx
<button
  type="button"
  className={`settings-nav-item ${activeTab === "updates" ? "active" : ""}`}
  onClick={() => onTabChange("updates")}
>
  Updates
</button>
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/frontend/components/settings/SettingsView.test.tsx`
Expected: PASS.

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat(settings): add Updates tab to settings sidebar
```

---

### Task 8: Implement Updates Settings Tab UI

**Files:**
- Modify: `src/frontend/components/settings/SettingsView.tsx`
- Modify: `src/frontend/components/settings/SettingsView.css`
- Modify: `src/frontend/components/settings/SettingsView.test.tsx`

**Step 1: Write failing tests**

Add to `src/frontend/components/settings/SettingsView.test.tsx`:

```ts
test("renders Updates content when activeTab is updates", async () => {
  setupMockRPC({
    getPluginSettings: () => Promise.resolve({ plugins: [] }),
    getUpdateSettings: () =>
      Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
  });
  const props = defaultProps();
  props.activeTab = "updates" as SettingsTab;
  const { findByText } = render(<SettingsView {...props} />);
  await findByText("Updates");
  await findByText("Update Channel");
});

test("Updates tab shows current channel selection", async () => {
  setupMockRPC({
    getPluginSettings: () => Promise.resolve({ plugins: [] }),
    getUpdateSettings: () =>
      Promise.resolve({ channel: "beta" as const, checkIntervalHours: 6, autoDownload: true }),
  });
  const props = defaultProps();
  props.activeTab = "updates" as SettingsTab;
  const { findByDisplayValue } = render(<SettingsView {...props} />);
  await findByDisplayValue("Beta");
});

test("Updates tab shows Check now button", async () => {
  setupMockRPC({
    getPluginSettings: () => Promise.resolve({ plugins: [] }),
    getUpdateSettings: () =>
      Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: true }),
  });
  const props = defaultProps();
  props.activeTab = "updates" as SettingsTab;
  const { findByRole } = render(<SettingsView {...props} />);
  await findByRole("button", { name: "Check now" });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/settings/SettingsView.test.tsx`
Expected: FAIL — no updates content rendered.

**Step 3: Add updates tab content to SettingsView**

In `src/frontend/components/settings/SettingsView.tsx`, add state variables:

```ts
import type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../../../shared/rpc-types.ts";

// Add these state variables inside SettingsView:
const [updateSettings, setUpdateSettings] = useState<UpdateSettingsInfo | null>(null);
const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
const [checking, setChecking] = useState(false);
```

In the `useEffect` that loads initial data, add `getUpdateSettings`:

```ts
useEffect(() => {
  Promise.all([
    getRPC().request.getPluginSettings({} as Record<string, never>),
    getRPC().request.getGeneralSettings({} as Record<string, never>),
    getRPC().request.getUpdateSettings({} as Record<string, never>),
  ])
    .then(([pluginData, generalData, updateData]) => {
      setPlugins(pluginData.plugins);
      setShowSecurityWarning(generalData.showSecurityWarning);
      setUpdateSettings(updateData);
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, []);
```

Add event listener for `updateStatus` messages:

```ts
useEffect(() => {
  const handleUpdateStatus = (e: Event) => {
    const detail = (e as CustomEvent<UpdateStatus>).detail;
    if (detail) setUpdateStatus(detail);
  };
  window.addEventListener("klovi:updateStatus", handleUpdateStatus);
  return () => window.removeEventListener("klovi:updateStatus", handleUpdateStatus);
}, []);
```

Add the updates tab rendering after the `{activeTab === "general" && (...)}` block:

```tsx
{activeTab === "updates" && (
  <>
    <h3 className="settings-section-title">Updates</h3>
    {loading ? (
      <div className="settings-loading">Loading...</div>
    ) : updateSettings && (
      <>
        <div className="settings-control-row">
          <span className="settings-control-label">Update Channel</span>
          <select
            className="settings-select"
            value={updateSettings.channel}
            onChange={(e) => {
              const channel = e.target.value as UpdateChannel;
              setUpdateSettings({ ...updateSettings, channel });
              getRPC()
                .request.updateUpdateSettings({ channel })
                .then(() => setChanged(true))
                .catch(() => {});
            }}
          >
            <option value="stable">Stable</option>
            <option value="candidate">Release Candidate</option>
            <option value="beta">Beta</option>
          </select>
        </div>

        <div className="settings-control-row">
          <span className="settings-control-label">Check Interval</span>
          <select
            className="settings-select"
            value={updateSettings.checkIntervalHours}
            onChange={(e) => {
              const checkIntervalHours = Number(e.target.value);
              setUpdateSettings({ ...updateSettings, checkIntervalHours });
              getRPC()
                .request.updateUpdateSettings({ checkIntervalHours })
                .then(() => setChanged(true))
                .catch(() => {});
            }}
          >
            <option value={1}>Every hour</option>
            <option value={3}>Every 3 hours</option>
            <option value={6}>Every 6 hours</option>
            <option value={12}>Every 12 hours</option>
            <option value={24}>Every 24 hours</option>
          </select>
        </div>

        <div className="settings-control-row">
          <div className="settings-control-group">
            <label className="settings-same-as-global">
              <input
                type="checkbox"
                className="custom-checkbox"
                checked={updateSettings.autoDownload}
                onChange={(e) => {
                  const autoDownload = e.target.checked;
                  setUpdateSettings({ ...updateSettings, autoDownload });
                  getRPC()
                    .request.updateUpdateSettings({ autoDownload })
                    .then(() => setChanged(true))
                    .catch(() => {});
                }}
              />
              Auto-download updates
            </label>
            <p className="settings-general-hint">
              When enabled, updates are downloaded in the background automatically.
            </p>
          </div>
        </div>

        <h4 className="settings-subsection-title">Status</h4>
        <div className="settings-control-row">
          <div className="settings-control-group">
            <div className="settings-update-status">
              {updateStatus?.status === "downloading" && updateStatus.progress !== undefined
                ? `Downloading v${updateStatus.latestVersion} (${updateStatus.progress}%)`
                : updateStatus?.status === "ready"
                  ? `v${updateStatus.latestVersion} ready to install`
                  : updateStatus?.status === "available"
                    ? `v${updateStatus.latestVersion} available`
                    : updateStatus?.status === "error"
                      ? `Error: ${updateStatus.error}`
                      : "Up to date"}
            </div>
            <button
              type="button"
              className="settings-reset-to-defaults-btn"
              disabled={checking}
              onClick={() => {
                setChecking(true);
                getRPC()
                  .request.checkForUpdate({} as Record<string, never>)
                  .then((result) => setUpdateStatus(result))
                  .catch(() => {})
                  .finally(() => setChecking(false));
              }}
            >
              {checking ? "Checking..." : "Check now"}
            </button>
          </div>
        </div>
      </>
    )}
  </>
)}
```

**Step 4: Add CSS for new elements**

Add to `src/frontend/components/settings/SettingsView.css`:

```css
.settings-select {
  padding: 5px 10px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
}

.settings-select:focus {
  outline: none;
  border-color: var(--accent);
}

.settings-update-status {
  font-size: 0.9rem;
  color: var(--text-secondary);
  padding: 4px 0;
}
```

**Step 5: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 6: Commit**

```
feat(settings): implement Updates tab with channel, interval, and status
```

---

### Task 9: Add Update Notification Bar

**Files:**
- Create: `src/frontend/components/UpdateNotification.tsx`
- Create: `src/frontend/components/UpdateNotification.css`
- Create: `src/frontend/components/UpdateNotification.test.tsx`
- Modify: `src/frontend/App.tsx`

**Step 1: Write failing tests**

Create `src/frontend/components/UpdateNotification.test.tsx`:

```ts
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { setupMockRPC } from "../test-helpers/mock-rpc.ts";
import { UpdateNotification } from "./UpdateNotification.tsx";

describe("UpdateNotification", () => {
  afterEach(cleanup);

  test("renders nothing when status is up-to-date", () => {
    const { container } = render(
      <UpdateNotification
        status={{ status: "up-to-date", currentVersion: "1.0.0" }}
        onDismiss={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders notification when status is ready", () => {
    setupMockRPC();
    const { getByText } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        onDismiss={() => {}}
      />,
    );
    expect(getByText(/v2\.0\.0 is ready/)).toBeDefined();
  });

  test("renders Restart button when ready", () => {
    setupMockRPC();
    const { getByRole } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        onDismiss={() => {}}
      />,
    );
    expect(getByRole("button", { name: "Restart to update" })).toBeDefined();
  });

  test("calls onDismiss when dismiss button clicked", () => {
    setupMockRPC();
    const onDismiss = mock();
    const { getByLabelText } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalled();
  });

  test("calls applyUpdate RPC when Restart clicked", () => {
    const applyUpdate = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({ applyUpdate });
    const { getByRole } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Restart to update" }));
    expect(applyUpdate).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/frontend/components/UpdateNotification.test.tsx`
Expected: FAIL — file doesn't exist.

**Step 3: Implement UpdateNotification component**

Create `src/frontend/components/UpdateNotification.tsx`:

```tsx
import type { UpdateStatus } from "../../shared/rpc-types.ts";
import { getRPC } from "../rpc.ts";
import "./UpdateNotification.css";

interface UpdateNotificationProps {
  status: UpdateStatus;
  onDismiss: () => void;
}

export function UpdateNotification({ status, onDismiss }: UpdateNotificationProps) {
  if (status.status !== "ready" || !status.latestVersion) {
    return null;
  }

  return (
    <div className="update-notification">
      <span className="update-notification-text">
        Klovi v{status.latestVersion} is ready
      </span>
      <button
        type="button"
        className="update-notification-action"
        onClick={() => {
          getRPC().request.applyUpdate({} as Record<string, never>).catch(() => {});
        }}
      >
        Restart to update
      </button>
      <button
        type="button"
        className="update-notification-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        &times;
      </button>
    </div>
  );
}
```

Create `src/frontend/components/UpdateNotification.css`:

```css
.update-notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: var(--accent-subtle);
  border-bottom: 1px solid var(--border-light);
  font-size: 0.85rem;
}

.update-notification-text {
  flex: 1;
  color: var(--text-primary);
}

.update-notification-action {
  background: var(--accent);
  border: none;
  padding: 4px 12px;
  font-size: 0.8rem;
  color: #fff;
  cursor: pointer;
}

.update-notification-action:hover {
  opacity: 0.9;
}

.update-notification-dismiss {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.update-notification-dismiss:hover {
  color: var(--text-primary);
}
```

**Step 4: Run tests**

Run: `bun test src/frontend/components/UpdateNotification.test.tsx`
Expected: All PASS.

**Step 5: Integrate into App.tsx**

In `src/frontend/App.tsx`, add state and event listener:

```tsx
import type { UpdateStatus } from "../shared/rpc-types.ts";
import { UpdateNotification } from "./components/UpdateNotification.tsx";

// Inside App():
const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
  status: "up-to-date",
  currentVersion: "",
});
const [updateDismissed, setUpdateDismissed] = useState(false);

useEffect(() => {
  const handleUpdateStatus = (e: Event) => {
    const detail = (e as CustomEvent<UpdateStatus>).detail;
    if (detail) {
      setUpdateStatus(detail);
      // Reset dismissed if a different version becomes available
      setUpdateDismissed(false);
    }
  };
  window.addEventListener("klovi:updateStatus", handleUpdateStatus);
  return () => window.removeEventListener("klovi:updateStatus", handleUpdateStatus);
}, []);
```

Add the notification bar just before the `<ErrorBoundary>` in the JSX:

```tsx
{!updateDismissed && (
  <UpdateNotification
    status={updateStatus}
    onDismiss={() => setUpdateDismissed(true)}
  />
)}
<ErrorBoundary>
  {/* ... existing content ... */}
</ErrorBoundary>
```

**Step 6: Wire updateStatus message in webview entry point**

In `src/views/main/index.ts`, update the `updateStatus` message handler:

```ts
updateStatus: (data) => {
  window.dispatchEvent(new CustomEvent("klovi:updateStatus", { detail: data }));
},
```

**Step 7: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 8: Commit**

```
feat(ui): add update notification bar with restart action
```

---

### Task 10: Add "Check for Updates..." Menu Item

**Files:**
- Modify: `src/bun/index.ts`
- Modify: `src/views/main/index.ts`
- Modify: `src/shared/rpc-types.ts`

**Step 1: Add menu message type**

In `src/shared/rpc-types.ts`, add to `webview.messages`:

```ts
checkForUpdates: Record<string, never>;
```

**Step 2: Add menu item**

In `src/bun/index.ts`, in the `ApplicationMenu.setApplicationMenu` call, add to the "Klovi" submenu after "Preferences...":

```ts
{ label: "Check for Updates...", action: "checkForUpdates" },
```

**Step 3: Forward menu action to webview**

In the `application-menu-clicked` event handler, add a case:

```ts
case "checkForUpdates":
  // Trigger check directly from main process
  getUpdateManager().check().catch(() => {});
  break;
```

**Step 4: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 5: Commit**

```
feat(menu): add Check for Updates menu item
```

---

### Task 11: Implement Platform-Specific Apply Logic

**Files:**
- Modify: `src/bun/updater.ts`

**Step 1: Implement the `apply()` method**

Replace the stub `apply()` method in `UpdateManager` with platform-specific logic adapted from Electrobun's Updater. Reference `node_modules/electrobun/dist/api/bun/core/Updater.ts` lines 755-1073 for the exact patterns.

The implementation should:
- **macOS:** Extract zip with `Bun.Archive`, find `.app` bundle, remove old bundle with `rmSync`, move new bundle with `renameSync`, clear quarantine xattr via `execSync`, relaunch via `open` with detached process that waits for current process to exit.
- **Linux:** Extract tar.gz, replace `{appDataDir}/app/` directory, chmod binaries, relaunch via launcher.
- **Windows:** Extract zip, write `update.bat` script, schedule via Task Scheduler, quit.

This task is mostly adapting existing Electrobun Updater code to work with the downloaded GitHub Release asset instead of Electrobun's internal tar files. Follow the exact patterns from the Electrobun source.

**Step 2: Run all checks**

Run: `bun run check && bun run typecheck && bun test`

**Step 3: Commit**

```
feat(updater): implement platform-specific update apply logic
```

---

### Task 12: Final Integration Testing & Cleanup

**Step 1: Run full test suite**

Run: `bun run check && bun run typecheck && bun test`

**Step 2: Manual smoke test**

Run: `bun run dev`
- Open Settings > Updates tab
- Verify channel selector, interval, auto-download toggle render
- Click "Check now" — verify it contacts GitHub API and shows status
- Verify notification bar appears if update is available
- Verify "Check for Updates..." menu item works

**Step 3: Clean up any stale update downloads from dev testing**

**Step 4: Commit any final fixes**

```
chore(updater): final integration fixes
```
