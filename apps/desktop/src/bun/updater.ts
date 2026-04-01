import { semver } from "bun";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadSettings } from "@cookielab.io/klovi-server/services/settings";
import type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../shared/rpc-types.ts";

const GITHUB_API_URL = "https://api.github.com/repos/cookielab/klovi/releases";
const ZSTD_SUFFIX_RE = /\.zst$/u;

type GitHubRelease = {
	tag_name: string;
	prerelease: boolean;
	draft: boolean;
	assets: GitHubAsset[];
};

type GitHubAsset = {
	name: string;
	browser_download_url: string;
};

type UpdateInfo = {
	version: string;
	hash: string;
	platform: string;
	arch: string;
};

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

type StatusCallback = (status: UpdateStatus) => void;

function filterReleasesByChannel(releases: GitHubRelease[], channel: UpdateChannel): GitHubRelease[] {
	return releases.filter((r) => {
		if (r.draft) {
			return false;
		}
		const tagChannel = getReleaseChannel(r.tag_name);
		switch (channel) {
			case "stable":
				return tagChannel === "stable";
			case "candidate":
				return tagChannel === "stable" || tagChannel === "candidate";
			case "beta":
				return true;
			default:
				return false;
		}
	});
}

function getReleaseChannel(tagName: string): UpdateChannel {
	if (tagName.includes("-beta.")) {
		return "beta";
	}
	if (tagName.includes("-rc.")) {
		return "candidate";
	}
	return "stable";
}

function getUpdaterAssetPrefix(platform: Platform, arch: Arch): string {
	return `stable-${platform}-${arch}`;
}

function getElectrobunTarballName(platform: Platform): string {
	return platform === "macos" ? "Klovi.app.tar.zst" : "Klovi.tar.zst";
}

function getReleaseBundleAssetName(platform: Platform, arch: Arch): string {
	return `${getUpdaterAssetPrefix(platform, arch)}-${getElectrobunTarballName(platform)}`;
}

function getUpdateJsonAssetName(platform: Platform, arch: Arch): string {
	return `${getUpdaterAssetPrefix(platform, arch)}-update.json`;
}

function isValidUpdateInfo(data: unknown): data is UpdateInfo {
	if (typeof data !== "object" || data === null) {
		return false;
	}
	const obj = data as Record<string, unknown>;
	return (
		typeof obj["version"] === "string" &&
		typeof obj["hash"] === "string" &&
		typeof obj["platform"] === "string" &&
		typeof obj["arch"] === "string"
	);
}

function validateUpdateInfo(data: UpdateInfo, tagName: string, platform: Platform, arch: Arch): string | null {
	if (data.version !== tagName) {
		return `version mismatch: expected "${tagName}", got "${data.version}"`;
	}
	if (data.platform !== platform) {
		return `platform mismatch: expected "${platform}", got "${data.platform}"`;
	}
	if (data.arch !== arch) {
		return `arch mismatch: expected "${arch}", got "${data.arch}"`;
	}
	if (!data.hash) {
		return "hash is empty";
	}
	return null;
}

function findReleaseAsset(release: GitHubRelease, name: string): GitHubAsset | null {
	return release.assets.find((asset) => asset.name === name) ?? null;
}

function getZstdBinaryPath(platform: Platform, executablePath = process.execPath): string {
	return join(dirname(executablePath), platform === "win" ? "zig-zstd.exe" : "zig-zstd");
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function getRequiredLauncherRelativePath(platform: Platform): string {
	switch (platform) {
		case "macos":
			return join("Contents", "MacOS", "launcher");
		case "linux":
			return join("bin", "launcher");
		case "win":
			return join("bin", "launcher.exe");
	}
}

async function findExtractedAppBundlePath(platform: Platform, stagingDir: string): Promise<string> {
	if (platform === "macos") {
		const entries = await readdir(stagingDir);
		const appBundle = entries.find((entry) => entry.endsWith(".app"));
		if (!appBundle) {
			throw new Error("Could not find .app bundle in extracted archive");
		}

		const appBundlePath = join(stagingDir, appBundle);
		if (!(await pathExists(appBundlePath))) {
			throw new Error("Extracted .app bundle does not exist");
		}

		return appBundlePath;
	}

	const entries = await readdir(stagingDir);
	for (const entry of entries) {
		const fullPath = join(stagingDir, entry);
		if ((await stat(fullPath)).isDirectory()) {
			return fullPath;
		}
	}

	if (platform === "linux") {
		throw new Error("Could not find app bundle directory in extracted archive");
	}
	throw new Error("Could not find app bundle in extracted archive");
}

async function validateExtractedBundle(platform: Platform, stagingDir: string): Promise<string> {
	const appBundlePath = await findExtractedAppBundlePath(platform, stagingDir);
	const launcherPath = join(appBundlePath, getRequiredLauncherRelativePath(platform));
	if (!(await pathExists(launcherPath))) {
		throw new Error(`Extracted app bundle is missing launcher: ${getRequiredLauncherRelativePath(platform)}`);
	}
	return appBundlePath;
}

/** Check whether a release has both the updater tarball and update.json assets. */
function releaseHasUpdaterAssets(release: GitHubRelease, platform: Platform, arch: Arch): boolean {
	const tarball = getReleaseBundleAssetName(platform, arch);
	const updateJson = getUpdateJsonAssetName(platform, arch);
	return findReleaseAsset(release, tarball) !== null && findReleaseAsset(release, updateJson) !== null;
}

async function fetchReleases(): Promise<GitHubRelease[]> {
	const response = await fetch(GITHUB_API_URL, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.status}`);
	}
	return response.json();
}

/**
 * Find the newest release that is:
 * 1. Newer than currentVersion
 * 2. Allowed by the channel filter
 * 3. Has both updater tarball and update.json assets
 */
function findLatestUsableRelease(
	releases: GitHubRelease[],
	channel: UpdateChannel,
	currentVersion: string,
	platform: Platform,
	arch: Arch,
): GitHubRelease | null {
	const filtered = filterReleasesByChannel(releases, channel);

	// Sort newest-first
	const sorted = [...filtered].sort((a, b) => semver.order(b.tag_name, a.tag_name));

	for (const release of sorted) {
		if (semver.order(release.tag_name, currentVersion) <= 0) {
			continue;
		}
		if (!releaseHasUpdaterAssets(release, platform, arch)) {
			continue;
		}
		return release;
	}
	return null;
}

/** @deprecated Use findLatestUsableRelease instead. Kept for backward compatibility in tests. */
function findLatestRelease(
	releases: GitHubRelease[],
	channel: UpdateChannel,
	currentVersion: string,
): GitHubRelease | null {
	const filtered = filterReleasesByChannel(releases, channel);
	let best: GitHubRelease | null = null;
	for (const release of filtered) {
		if (
			semver.order(release.tag_name, currentVersion) > 0 &&
			(!best || semver.order(release.tag_name, best.tag_name) > 0)
		) {
			best = release;
		}
	}
	return best;
}

class UpdateManager {
	private readonly currentVersion: string;
	private readonly platform: Platform;
	private readonly arch: Arch;
	private readonly settingsPath: string;
	private readonly appDataDir: string;
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

	private async getSettings(): Promise<UpdateSettingsInfo> {
		const settings = await loadSettings(this.settingsPath);
		return {
			channel: settings.updates?.channel ?? "stable",
			checkIntervalHours: settings.updates?.checkIntervalHours ?? 6,
			autoDownload: settings.updates?.autoDownload ?? true,
		};
	}

	private updatesDir(): string {
		return join(this.appDataDir, "updates");
	}

	async startSchedule(immediateCheck = true): Promise<void> {
		const settings = await this.getSettings();
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

	async restartSchedule(): Promise<void> {
		this.stopSchedule();
		await this.startSchedule(false);
	}

	async check(): Promise<UpdateStatus> {
		const now = Date.now();
		if (now - this.lastCheckTimestamp < 5 * 60 * 1000) {
			return this.currentStatus;
		}
		this.lastCheckTimestamp = now;

		const settings = await this.getSettings();

		try {
			const releases = await fetchReleases();
			const latest = findLatestUsableRelease(releases, settings.channel, this.currentVersion, this.platform, this.arch);

			if (!latest) {
				const status: UpdateStatus = { status: "up-to-date", currentVersion: this.currentVersion };
				this.emitStatus(status);
				return status;
			}

			// Fetch and validate update.json before marking as available
			const updateJsonName = getUpdateJsonAssetName(this.platform, this.arch);
			const updateJsonAsset = findReleaseAsset(latest, updateJsonName);
			if (!updateJsonAsset) {
				throw new Error(`Update metadata asset not found: ${updateJsonName}`);
			}
			const updateJsonResponse = await fetch(updateJsonAsset.browser_download_url);
			if (!updateJsonResponse.ok) {
				throw new Error(`Failed to fetch update metadata: HTTP ${updateJsonResponse.status}`);
			}
			const updateJsonData: unknown = await updateJsonResponse.json();
			if (!isValidUpdateInfo(updateJsonData)) {
				throw new Error("Invalid update metadata format");
			}
			const validationError = validateUpdateInfo(updateJsonData, latest.tag_name, this.platform, this.arch);
			if (validationError) {
				throw new Error(`Update metadata rejected: ${validationError}`);
			}

			this.latestRelease = latest;
			this.downloadedAssetPath = null;

			const status: UpdateStatus = {
				status: "available",
				currentVersion: this.currentVersion,
				latestVersion: latest.tag_name,
			};
			this.emitStatus(status);

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
		if (!(response.ok && response.body)) {
			throw new Error(`Download failed: HTTP ${response.status}`);
		}

		const contentLength = response.headers.get("content-length");
		const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;
		let bytesDownloaded = 0;

		const reader = response.body.getReader();
		const writer = Bun.file(destPath).writer();

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
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

		if (totalBytes && bytesDownloaded !== totalBytes) {
			try {
				await rm(destPath);
			} catch {}
			throw new Error(`Download size mismatch: expected ${totalBytes} bytes, got ${bytesDownloaded}`);
		}
	}

	private async fetchWithRetry(url: string, destPath: string, version: string): Promise<void> {
		const maxRetries = 3;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				await this.fetchAndSave(url, destPath, version);
				return;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error("Download failed");
				try {
					await rm(destPath);
				} catch {}
				if (attempt < maxRetries - 1) {
					const delay = 2 ** attempt * 1000;
					await Bun.sleep(delay);
				}
			}
		}
		throw lastError;
	}

	private async downloadBundleAsset(asset: GitHubAsset, compressedPath: string, version: string): Promise<void> {
		await this.fetchWithRetry(asset.browser_download_url, compressedPath, version);
	}

	private async decompressBundle(compressedPath: string, tarPath: string): Promise<void> {
		const zstdPath = getZstdBinaryPath(this.platform);
		if (!(await Bun.file(zstdPath).exists())) {
			throw new Error(`zig-zstd not found: ${zstdPath}`);
		}

		try {
			await rm(tarPath);
		} catch {}

		const result = Bun.spawnSync([zstdPath, "decompress", "-i", compressedPath, "-o", tarPath, "--no-timing"], {
			stdout: "ignore",
			stderr: "pipe",
		});
		if (!result.success) {
			const stderr = result.stderr ? Buffer.from(result.stderr).toString("utf8").trim() : "";
			throw new Error(stderr || `zig-zstd failed with exit code ${result.exitCode}`);
		}
	}

	private async extractBundle(tarPath: string, stagingDir: string): Promise<void> {
		const archiveBytes = await Bun.file(tarPath).arrayBuffer();
		const archive = new Bun.Archive(archiveBytes);
		await archive.extract(stagingDir);
	}

	async download(): Promise<void> {
		if (!this.latestRelease) {
			return;
		}

		const version = this.latestRelease.tag_name;
		const assetName = getReleaseBundleAssetName(this.platform, this.arch);
		const asset = findReleaseAsset(this.latestRelease, assetName);

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
		await mkdir(dir, { recursive: true });
		const compressedPath = join(dir, assetName);
		const tarPath = join(dir, assetName.replace(ZSTD_SUFFIX_RE, ""));

		try {
			await this.downloadBundleAsset(asset, compressedPath, version);
			await this.decompressBundle(compressedPath, tarPath);
		} catch (error) {
			try {
				await rm(dir, { recursive: true });
			} catch {}
			this.emitStatus({
				status: "error",
				currentVersion: this.currentVersion,
				latestVersion: version,
				error: error instanceof Error ? error.message : "Download failed",
			});
			return;
		}

		try {
			await rm(compressedPath);
		} catch {}

		this.downloadedAssetPath = tarPath;
		this.emitStatus({
			status: "ready",
			currentVersion: this.currentVersion,
			latestVersion: version,
		});
	}

	async apply(): Promise<void> {
		if (!(this.downloadedAssetPath && this.latestRelease)) {
			throw new Error("No downloaded update to apply");
		}

		const stagingDir = join(this.updatesDir(), "staging");
		await mkdir(stagingDir, { recursive: true });

		try {
			await this.extractBundle(this.downloadedAssetPath, stagingDir);

			if (this.platform === "macos") {
				await this.applyMacOS(stagingDir);
			} else if (this.platform === "linux") {
				throw new Error("Auto-update is not supported on Linux");
			} else if (this.platform === "win") {
				await this.applyWindows(stagingDir);
			}
		} catch (error) {
			try {
				await rm(stagingDir, { recursive: true });
			} catch {}
			throw error;
		}
	}

	private async applyMacOS(stagingDir: string): Promise<void> {
		const newAppPath = await validateExtractedBundle(this.platform, stagingDir);

		const runningAppPath = resolve(dirname(process.execPath), "..", "..");
		const backupPath = `${runningAppPath}.bak`;
		await rename(runningAppPath, backupPath);
		try {
			await rename(newAppPath, runningAppPath);
		} catch (error) {
			try {
				await rename(backupPath, runningAppPath);
			} catch {}
			throw error;
		}
		try {
			await rm(backupPath, { recursive: true });
		} catch {}

		try {
			const proc = Bun.spawn(["xattr", "-r", "-d", "com.apple.quarantine", runningAppPath], {
				stdout: "ignore",
				stderr: "ignore",
			});
			await proc.exited;
		} catch {}

		const pid = process.pid;
		Bun.spawn(
			["sh", "-c", `while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done; sleep 1; open "${runningAppPath}"`],
			// biome-ignore lint/suspicious/noExplicitAny: Bun's types don't include the detached option needed for process survival
			{ detached: true, stdio: ["ignore", "ignore", "ignore"] } as any,
		);

		try {
			await rm(join(this.updatesDir(), "staging"), { recursive: true });
		} catch {}

		const { Utils } = await import("electrobun/bun");
		Utils.quit();
	}

	private async applyWindows(stagingDir: string): Promise<void> {
		const runningAppPath = join(this.appDataDir, "app");
		const newAppPath = await validateExtractedBundle(this.platform, stagingDir);
		const launcherPath = join(runningAppPath, "bin", "launcher.exe");
		const parentDir = dirname(runningAppPath);
		const updateScriptPath = join(parentDir, "update.bat");

		const runningAppWin = runningAppPath.replace(/\//gu, "\\");
		const newAppWin = newAppPath.replace(/\//gu, "\\");
		const stagingDirWin = stagingDir.replace(/\//gu, "\\");
		const launcherPathWin = launcherPath.replace(/\//gu, "\\");

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

		const scriptPathWin = updateScriptPath.replace(/\//gu, "\\");
		const taskName = `KloviUpdate_${Date.now()}`;

		const createProc = Bun.spawn(
			["schtasks", "/create", "/tn", taskName, "/tr", `cmd /c "${scriptPathWin}"`, "/sc", "once", "/st", "00:00", "/f"],
			{ stdout: "ignore", stderr: "ignore" },
		);
		await createProc.exited;
		const runProc = Bun.spawn(["schtasks", "/run", "/tn", taskName], {
			stdout: "ignore",
			stderr: "ignore",
		});
		await runProc.exited;

		const { Utils } = await import("electrobun/bun");
		Utils.quit();
	}

	async cleanup(): Promise<void> {
		const dir = this.updatesDir();
		try {
			const entries = await readdir(dir);
			for (const entry of entries) {
				const fullPath = join(dir, entry);
				try {
					await rm(fullPath, { recursive: true });
				} catch {}
			}
		} catch {}
	}
}

export type { GitHubAsset, GitHubRelease, UpdateInfo };
export {
	filterReleasesByChannel,
	findExtractedAppBundlePath,
	findLatestRelease,
	findLatestUsableRelease,
	findReleaseAsset,
	getElectrobunTarballName,
	getReleaseBundleAssetName,
	getReleaseChannel,
	getRequiredLauncherRelativePath,
	getUpdateJsonAssetName,
	getUpdaterAssetPrefix,
	getZstdBinaryPath,
	isValidUpdateInfo,
	pathExists,
	releaseHasUpdaterAssets,
	UpdateManager,
	validateExtractedBundle,
	validateUpdateInfo,
};
