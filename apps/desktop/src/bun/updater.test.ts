import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { semver } from "bun";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import {
  filterReleasesByChannel,
  findLatestRelease,
  findReleaseAsset,
  type GitHubRelease,
  getElectrobunPlatformPrefix,
  getElectrobunTarballName,
  getReleaseBundleAssetName,
  getReleaseChannel,
  getUpdateJsonAssetName,
  getZstdBinaryPath,
  isValidUpdateInfo,
  UpdateManager,
} from "./updater.ts";

type MutableUpdateManagerForTest = {
  download(): Promise<void>;
  getStatus(): UpdateStatus;
  latestRelease: GitHubRelease | null;
};

describe("semver.order", () => {
  test("returns positive when a > b", () => {
    expect(semver.order("2.0.0", "1.0.0")).toBeGreaterThan(0);
  });

  test("returns negative when a < b", () => {
    expect(semver.order("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  test("returns 0 when equal", () => {
    expect(semver.order("1.2.3", "1.2.3")).toBe(0);
  });

  test("compares minor versions", () => {
    expect(semver.order("1.2.0", "1.1.0")).toBeGreaterThan(0);
  });

  test("compares patch versions", () => {
    expect(semver.order("1.0.2", "1.0.1")).toBeGreaterThan(0);
  });

  test("prerelease is less than release", () => {
    expect(semver.order("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
  });

  test("rc is greater than beta", () => {
    expect(semver.order("1.0.0-rc.1", "1.0.0-beta.1")).toBeGreaterThan(0);
  });

  test("beta.2 is greater than beta.1", () => {
    expect(semver.order("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
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

describe("Electrobun asset helpers", () => {
  test("maps release tags to updater channels", () => {
    expect(getReleaseChannel("2.0.0")).toBe("stable");
    expect(getReleaseChannel("2.1.0-rc.1")).toBe("candidate");
    expect(getReleaseChannel("2.1.0-beta.1")).toBe("beta");
  });

  test("builds platform prefixes", () => {
    expect(getElectrobunPlatformPrefix("stable", "macos", "arm64")).toBe("stable-macos-arm64");
    expect(getElectrobunPlatformPrefix("candidate", "win", "x64")).toBe("candidate-win-x64");
    expect(getElectrobunPlatformPrefix("beta", "linux", "arm64")).toBe("beta-linux-arm64");
  });

  test("returns normalized tarball names", () => {
    expect(getElectrobunTarballName("macos")).toBe("Klovi.app.tar.zst");
    expect(getElectrobunTarballName("linux")).toBe("Klovi.tar.zst");
    expect(getElectrobunTarballName("win")).toBe("Klovi.tar.zst");
  });

  test("builds macos release bundle asset name", () => {
    expect(getReleaseBundleAssetName("2.0.0", "macos", "arm64")).toBe(
      "stable-macos-arm64-Klovi.app.tar.zst",
    );
  });

  test("builds windows release bundle asset name", () => {
    expect(getReleaseBundleAssetName("2.1.0-rc.1", "win", "x64")).toBe(
      "candidate-win-x64-Klovi.tar.zst",
    );
  });

  test("builds linux x64 release bundle asset name", () => {
    expect(getReleaseBundleAssetName("2.1.0-beta.1", "linux", "x64")).toBe(
      "beta-linux-x64-Klovi.tar.zst",
    );
  });

  test("builds linux arm64 release bundle asset name", () => {
    expect(getReleaseBundleAssetName("2.0.0", "linux", "arm64")).toBe(
      "stable-linux-arm64-Klovi.tar.zst",
    );
  });

  test("resolves zstd path for unix platforms", () => {
    expect(getZstdBinaryPath("macos", "/Applications/Klovi.app/Contents/MacOS/Klovi")).toBe(
      "/Applications/Klovi.app/Contents/MacOS/zig-zstd",
    );
    expect(getZstdBinaryPath("linux", "/opt/Klovi/bin/launcher")).toBe("/opt/Klovi/bin/zig-zstd");
  });

  test("resolves zstd path for windows", () => {
    expect(getZstdBinaryPath("win", "C:/Users/demo/AppData/Local/Klovi/bin/launcher.exe")).toBe(
      "C:/Users/demo/AppData/Local/Klovi/bin/zig-zstd.exe",
    );
  });

  test("builds update.json asset names", () => {
    expect(getUpdateJsonAssetName("2.0.0", "macos", "arm64")).toBe(
      "stable-macos-arm64-update.json",
    );
    expect(getUpdateJsonAssetName("2.1.0-rc.1", "win", "x64")).toBe(
      "candidate-win-x64-update.json",
    );
    expect(getUpdateJsonAssetName("2.1.0-beta.1", "linux", "arm64")).toBe(
      "beta-linux-arm64-update.json",
    );
  });
});

describe("isValidUpdateInfo", () => {
  test("accepts valid update info", () => {
    expect(
      isValidUpdateInfo({ version: "2.0.0", hash: "abc123", platform: "macos", arch: "arm64" }),
    ).toBe(true);
  });

  test("rejects missing fields", () => {
    expect(isValidUpdateInfo({ version: "2.0.0", hash: "abc123" })).toBe(false);
  });

  test("rejects non-object", () => {
    expect(isValidUpdateInfo(null)).toBe(false);
    expect(isValidUpdateInfo("string")).toBe(false);
  });

  test("rejects wrong types", () => {
    expect(isValidUpdateInfo({ version: 1, hash: "abc", platform: "macos", arch: "arm64" })).toBe(
      false,
    );
  });
});

describe("findReleaseAsset", () => {
  test("ignores user-facing installer assets and returns normalized tarball", () => {
    const release: GitHubRelease = {
      ...makeRelease("2.1.0-rc.1", true),
      assets: [
        {
          name: "Klovi-2.1.0-windows-amd64.exe",
          browser_download_url: "https://example.com/setup.exe",
        },
        {
          name: "candidate-win-x64-Klovi.tar.zst",
          browser_download_url: "https://example.com/bundle.tar.zst",
        },
      ],
    };

    expect(findReleaseAsset(release, "candidate-win-x64-Klovi.tar.zst")?.browser_download_url).toBe(
      "https://example.com/bundle.tar.zst",
    );
  });

  test("returns null when the tarball asset is missing", () => {
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
          name: "beta-macos-arm64-Klovi.app.tar.zst",
          browser_download_url: "https://example.com/beta",
        },
      ],
    },
    {
      ...makeRelease("2.1.0-rc.1", true),
      assets: [
        {
          name: "candidate-macos-arm64-Klovi.app.tar.zst",
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

  test("returns stable release on candidate channel when it is newest allowed", () => {
    const result = findLatestRelease(releases, "candidate", "1.0.0");
    expect(result?.tag_name).toBe("2.1.0-rc.1");
  });

  test("returns highest version on beta channel", () => {
    const result = findLatestRelease(releases, "beta", "1.0.0");
    expect(result?.tag_name).toBe("2.1.0-rc.1");
  });
});

describe("UpdateManager", () => {
  const testDir = join(tmpdir(), `klovi-updater-test-${Date.now()}`);

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {}
  });

  test("constructor sets initial status to up-to-date", () => {
    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    });
    expect(mgr.getStatus()).toEqual({ status: "up-to-date", currentVersion: "1.0.0" });
  });

  test("cleanup removes files from updates directory", async () => {
    await mkdir(join(testDir, "updates", "2.0.0"), { recursive: true });
    await Bun.write(join(testDir, "updates", "2.0.0", "test.tar"), "data");

    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    });
    await mgr.cleanup();
    expect(await Bun.file(join(testDir, "updates", "2.0.0")).exists()).toBe(false);
  });

  test("cleanup does not throw when updates directory missing", async () => {
    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    });
    await expect(mgr.cleanup()).resolves.toBeUndefined();
  });

  test("setStatusCallback receives status updates", () => {
    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    });
    const statuses: UpdateStatus[] = [];
    mgr.setStatusCallback((status) => statuses.push(status));
    expect(mgr.getStatus().status).toBe("up-to-date");
    expect(statuses).toHaveLength(0);
  });

  test("download reports error when normalized tarball asset is missing", async () => {
    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    }) as unknown as MutableUpdateManagerForTest;

    mgr.latestRelease = {
      ...makeRelease("2.0.0", false),
      assets: [
        {
          name: "Klovi-2.0.0-macos-arm64.dmg",
          browser_download_url: "https://example.com/Klovi.dmg",
        },
        {
          name: "stable-macos-arm64-update.json",
          browser_download_url: "https://example.com/update.json",
        },
      ],
    };

    await mgr.download();

    expect(mgr.getStatus()).toEqual({
      status: "error",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      error: "Asset not found: stable-macos-arm64-Klovi.app.tar.zst",
    });
  });

  test("download reports error when update.json is missing", async () => {
    const mgr = new UpdateManager({
      currentVersion: "1.0.0",
      platform: "macos",
      arch: "arm64",
      settingsPath: join(testDir, "settings.json"),
      appDataDir: testDir,
    }) as unknown as MutableUpdateManagerForTest;

    mgr.latestRelease = {
      ...makeRelease("2.0.0", false),
      assets: [
        {
          name: "stable-macos-arm64-Klovi.app.tar.zst",
          browser_download_url: "https://example.com/bundle.tar.zst",
        },
      ],
    };

    await mgr.download();

    expect(mgr.getStatus()).toEqual({
      status: "error",
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      error: "Update metadata not found: stable-macos-arm64-update.json",
    });
  });
});
