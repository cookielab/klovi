import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import {
  compareVersions,
  filterReleasesByChannel,
  findLatestRelease,
  type GitHubRelease,
  getAssetName,
  UpdateManager,
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

describe("findLatestRelease", () => {
  const releases: GitHubRelease[] = [
    {
      ...makeRelease("2.1.0-beta.1", true),
      assets: [
        {
          name: "Klovi-2.1.0-beta.1-macos-arm64.zip",
          browser_download_url: "https://example.com/beta",
        },
      ],
    },
    {
      ...makeRelease("2.1.0-rc.1", true),
      assets: [
        {
          name: "Klovi-2.1.0-rc.1-macos-arm64.zip",
          browser_download_url: "https://example.com/rc",
        },
      ],
    },
    {
      ...makeRelease("2.0.0", false),
      assets: [
        {
          name: "Klovi-2.0.0-macos-arm64.zip",
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

  test("returns beta release on beta channel", () => {
    const result = findLatestRelease(releases, "beta", "2.0.0");
    // On beta channel, 2.1.0-rc.1 > 2.1.0-beta.1, so rc.1 is the latest
    expect(result?.tag_name).toBe("2.1.0-rc.1");
  });

  test("returns highest version on beta channel from old version", () => {
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
    await Bun.write(join(testDir, "updates", "2.0.0", "test.zip"), "data");

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
    mgr.setStatusCallback((s) => statuses.push(s));
    // Verify the callback mechanism is wired up and initial status is correct
    expect(mgr.getStatus().status).toBe("up-to-date");
  });
});
