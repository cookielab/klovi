import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../shared/rpc-types.ts";
import { loadSettings } from "./settings.ts";

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
    const [main = "", pre] = v.split("-");
    const parts = main.split(".").map(Number);
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
    return {
      major: parts[0] ?? 0,
      minor: parts[1] ?? 0,
      patch: parts[2] ?? 0,
      preType,
      preNum,
    };
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
      default:
        return false;
    }
  });
}

export type Platform = "macos" | "linux" | "win";
export type Arch = "arm64" | "x64";

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

  private async fetchAndSave(url: string, destPath: string, version: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;
    let bytesDownloaded = 0;

    const reader = response.body.getReader();
    const writer = Bun.file(destPath).writer();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      bytesDownloaded += value.length;

      if (bytesDownloaded % 500_000 < value.length) {
        const status: UpdateStatus = {
          status: "downloading",
          currentVersion: this.currentVersion,
          latestVersion: version,
        };
        if (totalBytes) {
          status.progress = Math.round((bytesDownloaded / totalBytes) * 100);
        }
        this.emitStatus(status);
      }
    }
    await writer.flush();
    writer.end();
  }

  async download(): Promise<void> {
    if (!this.latestRelease) return;

    const version = this.latestRelease.tag_name;
    const assetName = getAssetName(version, this.platform, this.arch);
    const asset = this.latestRelease.assets.find((a) => a.name === assetName);

    if (!asset) {
      this.emitStatus({
        status: "error",
        currentVersion: this.currentVersion,
        latestVersion: version,
        error: `Asset not found: ${assetName}`,
      });
      return;
    }

    this.emitStatus({
      status: "downloading",
      currentVersion: this.currentVersion,
      latestVersion: version,
      progress: 0,
    });

    const dir = join(this.updatesDir(), version);
    mkdirSync(dir, { recursive: true });
    const destPath = join(dir, assetName);

    try {
      await this.fetchAndSave(asset.browser_download_url, destPath, version);

      this.emitStatus({
        status: "ready",
        currentVersion: this.currentVersion,
        latestVersion: version,
      });
    } catch (error) {
      // Clean up partial download
      try {
        rmSync(dir, { recursive: true });
      } catch {}

      this.emitStatus({
        status: "error",
        currentVersion: this.currentVersion,
        latestVersion: version,
        error: error instanceof Error ? error.message : "Download failed",
      });
    }
  }

  async apply(): Promise<void> {
    // Placeholder — platform-specific logic implemented in Task 11
  }

  cleanup(): void {
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
