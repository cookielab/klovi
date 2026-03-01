import type { UpdateChannel } from "../shared/rpc-types.ts";

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
