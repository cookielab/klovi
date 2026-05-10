import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import type { UpdateChannel } from "../shared/rpc-types";

const { semver } = Bun;

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

function getElectrobunTarballName(platform: Platform): "Klovi.app.tar.zst" | "Klovi.tar.zst" {
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
		default:
			return join("bin", "launcher");
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

/**
 * Find the newest release that is:
 * 1. Newer than currentVersion
 * 2. Allowed by the channel filter
 * 3. Has both updater tarball and update.json assets
 */
function findLatestUsableRelease(options: {
	releases: GitHubRelease[];
	channel: UpdateChannel;
	currentVersion: string;
	platform: Platform;
	arch: Arch;
}): GitHubRelease | null {
	const filtered = filterReleasesByChannel(options.releases, options.channel);

	// Sort newest-first
	const sorted = [...filtered].sort((a, b) => semver.order(b.tag_name, a.tag_name));

	for (const release of sorted) {
		if (semver.order(release.tag_name, options.currentVersion) <= 0) {
			continue;
		}
		if (!releaseHasUpdaterAssets(release, options.platform, options.arch)) {
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

export type { Arch, GitHubAsset, GitHubRelease, Platform, UpdateInfo };
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
	validateExtractedBundle,
	validateUpdateInfo,
};
