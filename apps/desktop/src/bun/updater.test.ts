import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";

const { semver } = Bun;
import { Effect, Layer, SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types";
import { AppDataDirRef, SettingsPathRef, UpdaterConfig, UpdateStatusRef } from "./services";
import {
	filterReleasesByChannel,
	findExtractedAppBundlePath,
	findLatestRelease,
	findLatestUsableRelease,
	findReleaseAsset,
	type GitHubRelease,
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
} from "./updater";
import { cleanupUpdates, downloadUpdate, getCurrentStatus } from "./updater-service";

describe("semver.order", () => {
	it("returns positive when a > b", () => {
		expect(semver.order("2.0.0", "1.0.0")).toBeGreaterThan(0);
	});

	it("returns negative when a < b", () => {
		expect(semver.order("1.0.0", "2.0.0")).toBeLessThan(0);
	});

	it("returns 0 when equal", () => {
		expect(semver.order("1.2.3", "1.2.3")).toBe(0);
	});

	it("compares minor versions", () => {
		expect(semver.order("1.2.0", "1.1.0")).toBeGreaterThan(0);
	});

	it("compares patch versions", () => {
		expect(semver.order("1.0.2", "1.0.1")).toBeGreaterThan(0);
	});

	it("prerelease is less than release", () => {
		expect(semver.order("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
	});

	it("rc is greater than beta", () => {
		expect(semver.order("1.0.0-rc.1", "1.0.0-beta.1")).toBeGreaterThan(0);
	});

	it("beta.2 is greater than beta.1", () => {
		expect(semver.order("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
	});
});

function makeRelease(tag: string, prerelease: boolean): GitHubRelease {
	return {
		tag_name: tag,
		prerelease: prerelease,
		draft: false,
		assets: [],
	};
}

function makeReleaseWithAssets(
	tag: string,
	prerelease: boolean,
	platform: "macos" | "linux" | "win",
	arch: "arm64" | "x64",
	opts?: { missingTarball?: boolean; missingUpdateJson?: boolean },
): GitHubRelease {
	const tarballName = getReleaseBundleAssetName(platform, arch);
	const updateJsonName = getUpdateJsonAssetName(platform, arch);
	const assets: GitHubRelease["assets"] = [];
	if (!opts?.missingTarball) {
		assets.push({ name: tarballName, browser_download_url: `https://example.com/${tarballName}` });
	}
	if (!opts?.missingUpdateJson) {
		assets.push({
			name: updateJsonName,
			browser_download_url: `https://example.com/${updateJsonName}`,
		});
	}
	// Add a user-facing installer asset (should be ignored by updater)
	assets.push({
		name: `Klovi-${tag}-macos-arm64.dmg`,
		browser_download_url: `https://example.com/Klovi-${tag}.dmg`,
	});
	return { ...makeRelease(tag, prerelease), assets: assets };
}

describe("filterReleasesByChannel", () => {
	const releases: GitHubRelease[] = [
		makeRelease("2.0.0", false),
		makeRelease("2.1.0-rc.1", true),
		makeRelease("2.1.0-beta.1", true),
		makeRelease("1.9.0", false),
	];

	it("stable returns only non-prerelease", () => {
		const filtered = filterReleasesByChannel(releases, "stable");
		expect(filtered.map((r) => r.tag_name)).toEqual(["2.0.0", "1.9.0"]);
	});

	it("candidate returns non-prerelease and rc", () => {
		const filtered = filterReleasesByChannel(releases, "candidate");
		expect(filtered.map((r) => r.tag_name)).toEqual(["2.0.0", "2.1.0-rc.1", "1.9.0"]);
	});

	it("beta returns all releases", () => {
		const filtered = filterReleasesByChannel(releases, "beta");
		expect(filtered).toHaveLength(4);
	});
});

describe("filterReleasesByChannel ignores GitHub prerelease flag", () => {
	it("beta tag marked prerelease:false is excluded from stable", () => {
		const releases = [makeRelease("1.2.3-beta.1", false)];
		const filtered = filterReleasesByChannel(releases, "stable");
		expect(filtered).toHaveLength(0);
	});

	it("rc tag marked prerelease:false is excluded from stable", () => {
		const releases = [makeRelease("1.2.3-rc.1", false)];
		const filtered = filterReleasesByChannel(releases, "stable");
		expect(filtered).toHaveLength(0);
	});

	it("beta tag marked prerelease:false is excluded from candidate", () => {
		const releases = [makeRelease("1.2.3-beta.1", false)];
		const filtered = filterReleasesByChannel(releases, "candidate");
		expect(filtered).toHaveLength(0);
	});

	it("rc tag marked prerelease:true is accepted by candidate", () => {
		const releases = [makeRelease("1.2.3-rc.1", true)];
		const filtered = filterReleasesByChannel(releases, "candidate");
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.tag_name).toBe("1.2.3-rc.1");
	});

	it("stable tag marked prerelease:true is accepted by stable", () => {
		const releases = [makeRelease("1.2.3", true)];
		const filtered = filterReleasesByChannel(releases, "stable");
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.tag_name).toBe("1.2.3");
	});

	it("stable tag marked prerelease:true is accepted by candidate", () => {
		const releases = [makeRelease("1.2.3", true)];
		const filtered = filterReleasesByChannel(releases, "candidate");
		expect(filtered).toHaveLength(1);
	});

	it("all tags accepted by beta regardless of prerelease flag", () => {
		const releases = [makeRelease("1.2.3", true), makeRelease("1.2.3-rc.1", false), makeRelease("1.2.3-beta.1", false)];
		const filtered = filterReleasesByChannel(releases, "beta");
		expect(filtered).toHaveLength(3);
	});
});

describe("updater asset helpers", () => {
	it("maps release tags to updater channels", () => {
		expect(getReleaseChannel("2.0.0")).toBe("stable");
		expect(getReleaseChannel("2.1.0-rc.1")).toBe("candidate");
		expect(getReleaseChannel("2.1.0-beta.1")).toBe("beta");
	});

	it("always builds stable updater asset prefixes", () => {
		expect(getUpdaterAssetPrefix("macos", "arm64")).toBe("stable-macos-arm64");
		expect(getUpdaterAssetPrefix("win", "x64")).toBe("stable-win-x64");
		expect(getUpdaterAssetPrefix("linux", "arm64")).toBe("stable-linux-arm64");
	});

	it("returns normalized tarball names", () => {
		expect(getElectrobunTarballName("macos")).toBe("Klovi.app.tar.zst");
		expect(getElectrobunTarballName("linux")).toBe("Klovi.tar.zst");
		expect(getElectrobunTarballName("win")).toBe("Klovi.tar.zst");
	});

	it("builds macos release bundle asset name", () => {
		expect(getReleaseBundleAssetName("macos", "arm64")).toBe("stable-macos-arm64-Klovi.app.tar.zst");
	});

	it("builds windows release bundle asset name", () => {
		expect(getReleaseBundleAssetName("win", "x64")).toBe("stable-win-x64-Klovi.tar.zst");
	});

	it("builds linux x64 release bundle asset name", () => {
		expect(getReleaseBundleAssetName("linux", "x64")).toBe("stable-linux-x64-Klovi.tar.zst");
	});

	it("builds linux arm64 release bundle asset name", () => {
		expect(getReleaseBundleAssetName("linux", "arm64")).toBe("stable-linux-arm64-Klovi.tar.zst");
	});

	it("resolves zstd path for unix platforms", () => {
		expect(getZstdBinaryPath("macos", "/Applications/Klovi.app/Contents/MacOS/Klovi")).toBe(
			"/Applications/Klovi.app/Contents/MacOS/zig-zstd",
		);
		expect(getZstdBinaryPath("linux", "/opt/Klovi/bin/launcher")).toBe("/opt/Klovi/bin/zig-zstd");
	});

	it("resolves zstd path for windows", () => {
		expect(getZstdBinaryPath("win", "C:/Users/demo/AppData/Local/Klovi/bin/launcher.exe")).toBe(
			"C:/Users/demo/AppData/Local/Klovi/bin/zig-zstd.exe",
		);
	});

	it("builds update.json asset names", () => {
		expect(getUpdateJsonAssetName("macos", "arm64")).toBe("stable-macos-arm64-update.json");
		expect(getUpdateJsonAssetName("win", "x64")).toBe("stable-win-x64-update.json");
		expect(getUpdateJsonAssetName("linux", "arm64")).toBe("stable-linux-arm64-update.json");
	});

	it("pathExists returns true for directories", async () => {
		const dir = join(tmpdir(), `klovi-path-exists-test-${Date.now()}`);
		const appPath = join(dir, "Klovi.app");
		await mkdir(appPath, { recursive: true });
		try {
			await expect(pathExists(appPath)).resolves.toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("returns required launcher path for each platform", () => {
		expect(getRequiredLauncherRelativePath("macos")).toBe("Contents/MacOS/launcher");
		expect(getRequiredLauncherRelativePath("linux")).toBe("bin/launcher");
		expect(getRequiredLauncherRelativePath("win")).toBe("bin/launcher.exe");
	});

	it("finds macOS .app bundle path", async () => {
		const dir = join(tmpdir(), `klovi-macos-bundle-test-${Date.now()}`);
		const appPath = join(dir, "Klovi.app");
		await mkdir(appPath, { recursive: true });
		try {
			await expect(findExtractedAppBundlePath("macos", dir)).resolves.toBe(appPath);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("validateExtractedBundle accepts macOS extracted bundle", async () => {
		const dir = join(tmpdir(), `klovi-macos-validate-test-${Date.now()}`);
		const launcherPath = join(dir, "Klovi.app", "Contents", "MacOS", "launcher");
		await mkdir(join(launcherPath, ".."), { recursive: true });
		await Bun.write(launcherPath, "#!/bin/sh\n");
		try {
			await expect(validateExtractedBundle("macos", dir)).resolves.toBe(join(dir, "Klovi.app"));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("validateExtractedBundle accepts linux extracted bundle", async () => {
		const dir = join(tmpdir(), `klovi-linux-validate-test-${Date.now()}`);
		const launcherPath = join(dir, "Klovi", "bin", "launcher");
		await mkdir(join(launcherPath, ".."), { recursive: true });
		await Bun.write(launcherPath, "#!/bin/sh\n");
		try {
			await expect(validateExtractedBundle("linux", dir)).resolves.toBe(join(dir, "Klovi"));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("validateExtractedBundle accepts windows extracted bundle", async () => {
		const dir = join(tmpdir(), `klovi-win-validate-test-${Date.now()}`);
		const launcherPath = join(dir, "Klovi", "bin", "launcher.exe");
		await mkdir(join(launcherPath, ".."), { recursive: true });
		await Bun.write(launcherPath, "binary");
		try {
			await expect(validateExtractedBundle("win", dir)).resolves.toBe(join(dir, "Klovi"));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("validateExtractedBundle rejects bundle missing launcher", async () => {
		const dir = join(tmpdir(), `klovi-missing-launcher-test-${Date.now()}`);
		await mkdir(join(dir, "Klovi.app"), { recursive: true });
		try {
			await expect(validateExtractedBundle("macos", dir)).rejects.toThrow("Extracted app bundle is missing launcher");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("isValidUpdateInfo", () => {
	it("accepts valid update info", () => {
		expect(isValidUpdateInfo({ version: "2.0.0", hash: "abc123", platform: "macos", arch: "arm64" })).toBe(true);
	});

	it("rejects missing fields", () => {
		expect(isValidUpdateInfo({ version: "2.0.0", hash: "abc123" })).toBe(false);
	});

	it("rejects non-object", () => {
		expect(isValidUpdateInfo(null)).toBe(false);
		expect(isValidUpdateInfo("string")).toBe(false);
	});

	it("rejects wrong types", () => {
		expect(isValidUpdateInfo({ version: 1, hash: "abc", platform: "macos", arch: "arm64" })).toBe(false);
	});
});

describe("validateUpdateInfo", () => {
	it("returns null for valid matching info", () => {
		const info = { version: "2.0.0", hash: "abc123", platform: "macos", arch: "arm64" };
		expect(validateUpdateInfo(info, "2.0.0", "macos", "arm64")).toBeNull();
	});

	it("rejects mismatched version", () => {
		const info = { version: "1.9.0", hash: "abc123", platform: "macos", arch: "arm64" };
		expect(validateUpdateInfo(info, "2.0.0", "macos", "arm64")).toContain("version mismatch");
	});

	it("rejects mismatched platform", () => {
		const info = { version: "2.0.0", hash: "abc123", platform: "linux", arch: "arm64" };
		expect(validateUpdateInfo(info, "2.0.0", "macos", "arm64")).toContain("platform mismatch");
	});

	it("rejects mismatched arch", () => {
		const info = { version: "2.0.0", hash: "abc123", platform: "macos", arch: "x64" };
		expect(validateUpdateInfo(info, "2.0.0", "macos", "arm64")).toContain("arch mismatch");
	});

	it("rejects empty hash", () => {
		const info = { version: "2.0.0", hash: "", platform: "macos", arch: "arm64" };
		expect(validateUpdateInfo(info, "2.0.0", "macos", "arm64")).toContain("hash is empty");
	});
});

describe("releaseHasUpdaterAssets", () => {
	it("returns true when both tarball and update.json exist", () => {
		const release = makeReleaseWithAssets("2.0.0", false, "macos", "arm64");
		expect(releaseHasUpdaterAssets(release, "macos", "arm64")).toBe(true);
	});

	it("returns false when tarball is missing", () => {
		const release = makeReleaseWithAssets("2.0.0", false, "macos", "arm64", {
			missingTarball: true,
		});
		expect(releaseHasUpdaterAssets(release, "macos", "arm64")).toBe(false);
	});

	it("returns false when update.json is missing", () => {
		const release = makeReleaseWithAssets("2.0.0", false, "macos", "arm64", {
			missingUpdateJson: true,
		});
		expect(releaseHasUpdaterAssets(release, "macos", "arm64")).toBe(false);
	});
});

describe("findReleaseAsset", () => {
	it("ignores user-facing installer assets and returns normalized tarball", () => {
		const release: GitHubRelease = {
			...makeRelease("2.1.0-rc.1", true),
			assets: [
				{
					name: "Klovi-2.1.0-windows-amd64.exe",
					browser_download_url: "https://example.com/setup.exe",
				},
				{
					name: "stable-win-x64-Klovi.tar.zst",
					browser_download_url: "https://example.com/bundle.tar.zst",
				},
			],
		};

		expect(findReleaseAsset(release, "stable-win-x64-Klovi.tar.zst")?.browser_download_url).toBe(
			"https://example.com/bundle.tar.zst",
		);
	});

	it("returns null when the tarball asset is missing", () => {
		const release: GitHubRelease = {
			...makeRelease("2.0.0", false),
			assets: [
				{
					name: "Klovi-2.0.0-macos-arm64.dmg",
					browser_download_url: "https://example.com/Klovi.dmg",
				},
			],
		};

		expect(findReleaseAsset(release, "stable-macos-arm64-Klovi.app.tar.zst")).toBeNull();
	});
});

describe("findLatestRelease", () => {
	const releases: GitHubRelease[] = [
		{
			...makeRelease("2.1.0-beta.1", true),
			assets: [
				{
					name: "stable-macos-arm64-Klovi.app.tar.zst",
					browser_download_url: "https://example.com/beta",
				},
			],
		},
		{
			...makeRelease("2.1.0-rc.1", true),
			assets: [
				{
					name: "stable-macos-arm64-Klovi.app.tar.zst",
					browser_download_url: "https://example.com/rc",
				},
			],
		},
		{
			...makeRelease("2.0.0", false),
			assets: [
				{
					name: "stable-macos-arm64-Klovi.app.tar.zst",
					browser_download_url: "https://example.com/stable",
				},
			],
		},
		{ ...makeRelease("1.9.0", false), assets: [] },
	];

	it("returns null when current version is latest on stable", () => {
		const result = findLatestRelease(releases, "stable", "2.0.0");
		expect(result).toBeNull();
	});

	it("returns newer stable release", () => {
		const result = findLatestRelease(releases, "stable", "1.9.0");
		expect(result?.tag_name).toBe("2.0.0");
	});

	it("returns rc release on candidate channel", () => {
		const result = findLatestRelease(releases, "candidate", "2.0.0");
		expect(result?.tag_name).toBe("2.1.0-rc.1");
	});

	it("returns stable release on candidate channel when it is newest allowed", () => {
		const result = findLatestRelease(releases, "candidate", "1.0.0");
		expect(result?.tag_name).toBe("2.1.0-rc.1");
	});

	it("returns highest version on beta channel", () => {
		const result = findLatestRelease(releases, "beta", "1.0.0");
		expect(result?.tag_name).toBe("2.1.0-rc.1");
	});
});

describe("findLatestUsableRelease", () => {
	it("skips incomplete newer release and picks newest usable", () => {
		const releases: GitHubRelease[] = [
			// Newer but missing update.json
			makeReleaseWithAssets("2.2.0", false, "macos", "arm64", { missingUpdateJson: true }),
			// Complete release
			makeReleaseWithAssets("2.1.0", false, "macos", "arm64"),
			// Older
			makeReleaseWithAssets("2.0.0", false, "macos", "arm64"),
		];

		const result = findLatestUsableRelease({
			releases: releases,
			channel: "stable",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result?.tag_name).toBe("2.1.0");
	});

	it("skips release missing normalized tarball", () => {
		const releases: GitHubRelease[] = [
			makeReleaseWithAssets("2.1.0", false, "macos", "arm64", { missingTarball: true }),
			makeReleaseWithAssets("2.0.0", false, "macos", "arm64"),
		];

		const result = findLatestUsableRelease({
			releases: releases,
			channel: "stable",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result?.tag_name).toBe("2.0.0");
	});

	it("returns null when no usable release is newer", () => {
		const releases: GitHubRelease[] = [
			makeReleaseWithAssets("2.0.0", false, "macos", "arm64", { missingUpdateJson: true }),
		];
		const result = findLatestUsableRelease({
			releases: releases,
			channel: "stable",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result).toBeNull();
	});

	it("returns null when current is latest", () => {
		const releases: GitHubRelease[] = [makeReleaseWithAssets("2.0.0", false, "macos", "arm64")];
		const result = findLatestUsableRelease({
			releases: releases,
			channel: "stable",
			currentVersion: "2.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result).toBeNull();
	});

	it("user-facing installer assets are ignored for selection", () => {
		// Release only has a DMG (user-facing), no updater assets
		const release: GitHubRelease = {
			...makeRelease("2.1.0", false),
			assets: [
				{
					name: "Klovi-2.1.0-macos-arm64.dmg",
					browser_download_url: "https://example.com/Klovi.dmg",
				},
			],
		};
		const result = findLatestUsableRelease({
			releases: [release],
			channel: "stable",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result).toBeNull();
	});

	it("respects channel filtering for usable releases", () => {
		const releases: GitHubRelease[] = [
			makeReleaseWithAssets("2.1.0-beta.1", true, "macos", "arm64"),
			makeReleaseWithAssets("2.0.0", false, "macos", "arm64"),
		];
		// Stable channel should not see beta
		const stable = findLatestUsableRelease({
			releases: releases,
			channel: "stable",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(stable?.tag_name).toBe("2.0.0");

		// Beta channel should see both, pick newest
		const beta = findLatestUsableRelease({
			releases: releases,
			channel: "beta",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(beta?.tag_name).toBe("2.1.0-beta.1");
	});

	it("rejects legacy beta-prefixed updater assets under the future-only contract", () => {
		const legacyBetaRelease: GitHubRelease = {
			...makeRelease("2.1.0-beta.1", true),
			assets: [
				{
					name: "beta-macos-arm64-Klovi.app.tar.zst",
					browser_download_url: "https://example.com/beta.tar.zst",
				},
				{
					name: "beta-macos-arm64-update.json",
					browser_download_url: "https://example.com/beta-update.json",
				},
			],
		};

		const result = findLatestUsableRelease({
			releases: [legacyBetaRelease],
			channel: "beta",
			currentVersion: "1.0.0",
			platform: "macos",
			arch: "arm64",
		});
		expect(result).toBeNull();
	});
});

describe("updater-service", () => {
	const testDir = join(tmpdir(), `klovi-updater-svc-test-${Date.now()}`);

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true });
		} catch {}
	});

	function makeTestLayer() {
		return Layer.mergeAll(
			Layer.succeed(UpdaterConfig, {
				currentVersion: "1.0.0",
				platform: "macos" as const,
				arch: "arm64" as const,
			}),
			Layer.succeed(SettingsPathRef, { path: join(testDir, "settings.json") }),
			Layer.succeed(AppDataDirRef, { path: testDir }),
			Layer.effect(
				UpdateStatusRef,
				SubscriptionRef.make<UpdateStatus>({ status: "up-to-date", currentVersion: "1.0.0" }),
			),
			BunContext.layer,
		);
	}

	it("getCurrentStatus returns initial up-to-date status", async () => {
		const result = await Effect.runPromise(getCurrentStatus.pipe(Effect.provide(makeTestLayer())));
		expect(result).toEqual({ status: "up-to-date", currentVersion: "1.0.0" });
	});

	it("cleanupUpdates removes files from updates directory", async () => {
		await mkdir(join(testDir, "updates", "2.0.0"), { recursive: true });
		await Bun.write(join(testDir, "updates", "2.0.0", "test.tar"), "data");

		await Effect.runPromise(cleanupUpdates.pipe(Effect.provide(makeTestLayer())));
		expect(await Bun.file(join(testDir, "updates", "2.0.0")).exists()).toBe(false);
	});

	it("cleanupUpdates does not fail when updates directory missing", async () => {
		await expect(Effect.runPromise(cleanupUpdates.pipe(Effect.provide(makeTestLayer())))).resolves.toBeUndefined();
	});

	it("downloadUpdate is no-op when no latestRelease set", async () => {
		await Effect.runPromise(downloadUpdate.pipe(Effect.provide(makeTestLayer())));
		const status = await Effect.runPromise(getCurrentStatus.pipe(Effect.provide(makeTestLayer())));
		expect(status.status).toBe("up-to-date");
	});
});
