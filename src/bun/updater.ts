import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

  startSchedule(immediateCheck = true): void {
    const settings = this.getSettings();
    const intervalMs = settings.checkIntervalHours * 60 * 60 * 1000;

    if (immediateCheck) {
      this.check().catch(() => {});
    }

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
    this.startSchedule(false);
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

    // Verify file size matches Content-Length (C4)
    if (totalBytes && bytesDownloaded !== totalBytes) {
      try {
        rmSync(destPath);
      } catch {}
      throw new Error(
        `Download size mismatch: expected ${totalBytes} bytes, got ${bytesDownloaded}`,
      );
    }
  }

  private async fetchWithRetry(url: string, destPath: string, version: string): Promise<void> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.fetchAndSave(url, destPath, version);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Download failed");
        try {
          rmSync(destPath);
        } catch {}
        if (attempt < MAX_RETRIES - 1) {
          const delay = 2 ** attempt * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
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
      await this.fetchWithRetry(asset.browser_download_url, destPath, version);
    } catch (error) {
      try {
        rmSync(dir, { recursive: true });
      } catch {}
      this.emitStatus({
        status: "error",
        currentVersion: this.currentVersion,
        latestVersion: version,
        error: error instanceof Error ? error.message : "Download failed",
      });
      return;
    }

    this.downloadedAssetPath = destPath;
    this.emitStatus({
      status: "ready",
      currentVersion: this.currentVersion,
      latestVersion: version,
    });
  }

  async apply(): Promise<void> {
    if (!this.downloadedAssetPath || !this.latestRelease) {
      throw new Error("No downloaded update to apply");
    }

    const stagingDir = join(this.updatesDir(), "staging");
    mkdirSync(stagingDir, { recursive: true });

    try {
      // Extract the archive
      if (this.platform === "linux") {
        // tar.gz extraction using system tar
        const result = Bun.spawnSync(["tar", "xzf", this.downloadedAssetPath, "-C", stagingDir]);
        if (!result.success) {
          throw new Error(`tar extraction failed with exit code ${result.exitCode}`);
        }
      } else {
        // zip extraction using Bun.Archive (macOS + Windows)
        const archiveBytes = await Bun.file(this.downloadedAssetPath).arrayBuffer();
        const archive = new Bun.Archive(archiveBytes);
        await archive.extract(stagingDir);
      }

      if (this.platform === "macos") {
        await this.applyMacOS(stagingDir);
      } else if (this.platform === "linux") {
        await this.applyLinux(stagingDir);
      } else if (this.platform === "win") {
        await this.applyWindows(stagingDir);
      }
    } catch (error) {
      // Clean up staging
      try {
        rmSync(stagingDir, { recursive: true });
      } catch {}
      // Don't emitStatus here — it would change the status prop to "error",
      // unmounting ReadyBanner before the RPC response arrives. The error
      // is propagated via the thrown error → RPC handler → { ok: false }.
      throw error;
    }
  }

  private async applyMacOS(stagingDir: string): Promise<void> {
    // Find the .app bundle in extracted directory
    const entries = readdirSync(stagingDir);
    const appBundle = entries.find((e) => e.endsWith(".app"));
    if (!appBundle) throw new Error("Could not find .app bundle in extracted archive");

    const newAppPath = join(stagingDir, appBundle);
    if (!existsSync(newAppPath)) throw new Error("Extracted .app bundle does not exist");

    // The running app's bundle path: process.execPath is at Contents/MacOS/binary
    const runningAppPath = resolve(dirname(process.execPath), "..", "..");

    // Backup-then-swap: rename old app to backup, move new in, delete backup
    const backupPath = `${runningAppPath}.bak`;
    renameSync(runningAppPath, backupPath);
    try {
      renameSync(newAppPath, runningAppPath);
    } catch (error) {
      // Restore from backup if move fails
      try {
        renameSync(backupPath, runningAppPath);
      } catch {}
      throw error;
    }
    // Remove backup after successful swap
    try {
      rmSync(backupPath, { recursive: true });
    } catch {}

    // Remove quarantine xattr to prevent "damaged" error.
    // All paths are app-internal, not user-supplied.
    try {
      execSync(`xattr -r -d com.apple.quarantine "${runningAppPath}"`, { stdio: "ignore" });
    } catch {}

    // Relaunch after current process exits
    const pid = process.pid;
    Bun.spawn(
      [
        "sh",
        "-c",
        `while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done; sleep 1; open "${runningAppPath}"`,
      ],
      // biome-ignore lint/suspicious/noExplicitAny: Bun's types don't include the detached option needed for process survival
      { detached: true, stdio: ["ignore", "ignore", "ignore"] } as any,
    );

    // Clean up staging
    try {
      rmSync(join(this.updatesDir(), "staging"), { recursive: true });
    } catch {}

    // Quit the app
    const { Utils } = await import("electrobun/bun");
    Utils.quit();
  }

  private async applyLinux(stagingDir: string): Promise<void> {
    // Find the app bundle directory
    const entries = readdirSync(stagingDir);
    const appBundleDir = entries.find((e) => {
      const fullPath = join(stagingDir, e);
      return statSync(fullPath).isDirectory();
    });
    if (!appBundleDir) throw new Error("Could not find app bundle directory in extracted archive");

    const newAppPath = join(stagingDir, appBundleDir);
    const runningAppPath = join(this.appDataDir, "app");

    // Backup-then-swap: rename old app to backup, move new in, delete backup
    const backupPath = `${runningAppPath}.bak`;
    if (existsSync(runningAppPath)) {
      renameSync(runningAppPath, backupPath);
    }
    try {
      renameSync(newAppPath, runningAppPath);
    } catch (error) {
      // Restore from backup if move fails
      if (existsSync(backupPath)) {
        try {
          renameSync(backupPath, runningAppPath);
        } catch {}
      }
      throw error;
    }
    // Remove backup after successful swap
    try {
      rmSync(backupPath, { recursive: true });
    } catch {}

    // Ensure binaries are executable.
    // All paths are app-internal, not user-supplied.
    const launcherPath = join(runningAppPath, "bin", "launcher");
    if (existsSync(launcherPath)) {
      execSync(`chmod +x "${launcherPath}"`);
    }
    const bunPath = join(runningAppPath, "bin", "bun");
    if (existsSync(bunPath)) {
      execSync(`chmod +x "${bunPath}"`);
    }

    // Relaunch
    // biome-ignore lint/suspicious/noExplicitAny: Bun's types don't include the detached option needed for process survival
    Bun.spawn(["sh", "-c", `"${launcherPath}" &`], { detached: true } as any);

    // Clean up staging
    try {
      rmSync(join(this.updatesDir(), "staging"), { recursive: true });
    } catch {}

    // Quit the app
    const { Utils } = await import("electrobun/bun");
    Utils.quit();
  }

  private async applyWindows(stagingDir: string): Promise<void> {
    const runningAppPath = join(this.appDataDir, "app");

    // Find app directory in staging
    const entries = readdirSync(stagingDir);
    const appBundleDir = entries.find((e) => {
      const fullPath = join(stagingDir, e);
      return statSync(fullPath).isDirectory();
    });
    if (!appBundleDir) throw new Error("Could not find app bundle in extracted archive");

    const newAppPath = join(stagingDir, appBundleDir);
    const launcherPath = join(runningAppPath, "bin", "launcher.exe");

    // Write update batch script.
    // All paths are app-internal, not user-supplied.
    const parentDir = dirname(runningAppPath);
    const updateScriptPath = join(parentDir, "update.bat");

    const runningAppWin = runningAppPath.replace(/\//g, "\\");
    const newAppWin = newAppPath.replace(/\//g, "\\");
    const stagingDirWin = stagingDir.replace(/\//g, "\\");
    const launcherPathWin = launcherPath.replace(/\//g, "\\");

    const pid = process.pid;
    const updateScript = `@echo off
setlocal

:waitloop
tasklist /FI "PID eq ${pid}" 2>NUL | find /I /N "${pid}">NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 1 /nobreak >nul
    goto waitloop
)

timeout /t 2 /nobreak >nul

if exist "${runningAppWin}" (
    rmdir /s /q "${runningAppWin}"
)

move "${newAppWin}" "${runningAppWin}"

rmdir /s /q "${stagingDirWin}" 2>nul

start "" "${launcherPathWin}"

ping -n 2 127.0.0.1 >nul
del "%~f0"
`;

    await Bun.write(updateScriptPath, updateScript);

    // Use Windows Task Scheduler to run the update script independently.
    // All paths are app-internal, not user-supplied.
    const scriptPathWin = updateScriptPath.replace(/\//g, "\\");
    const taskName = `KloviUpdate_${Date.now()}`;

    execSync(
      `schtasks /create /tn "${taskName}" /tr "cmd /c \\"${scriptPathWin}\\"" /sc once /st 00:00 /f`,
      {
        stdio: "ignore",
      },
    );
    execSync(`schtasks /run /tn "${taskName}"`, { stdio: "ignore" });

    // Quit the app
    const { Utils } = await import("electrobun/bun");
    Utils.quit();
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
