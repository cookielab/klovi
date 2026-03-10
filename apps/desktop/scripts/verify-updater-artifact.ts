#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  isValidUpdateInfo,
  validateExtractedBundle,
  validateUpdateInfo,
} from "../src/bun/updater.ts";

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

export type VerifyUpdaterArtifactArgs = {
  platform: Platform;
  arch: Arch;
  version: string;
  tarballPath: string;
  updateJsonPath: string;
  zstdPath?: string;
};

export function parseArgs(argv: string[]): VerifyUpdaterArtifactArgs {
  const args = argv.slice(2);

  let platform: Platform | undefined;
  let arch: Arch | undefined;
  let version: string | undefined;
  let tarballPath: string | undefined;
  let updateJsonPath: string | undefined;
  let zstdPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--platform":
        platform = parsePlatform(args[++i]);
        break;
      case "--arch":
        arch = parseArch(args[++i]);
        break;
      case "--version":
        version = args[++i];
        break;
      case "--tarball":
        tarballPath = args[++i];
        break;
      case "--update-json":
        updateJsonPath = args[++i];
        break;
      case "--zstd":
        zstdPath = args[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!platform || !arch || !version || !tarballPath || !updateJsonPath) {
    throw new Error(
      "Usage: bun verify-updater-artifact.ts --platform <macos|linux|win> --arch <arm64|x64> --version <semver> --tarball <path> --update-json <path> [--zstd <path>]",
    );
  }

  return {
    platform,
    arch,
    version,
    tarballPath,
    updateJsonPath,
    ...(zstdPath ? { zstdPath } : {}),
  };
}

export function getDefaultZstdPaths(platform: Platform, arch: Arch): string[] {
  const binaryName = platform === "win" ? "zig-zstd.exe" : "zig-zstd";
  return [
    resolve(
      import.meta.dir,
      "..",
      "node_modules",
      "electrobun",
      `dist-${platform}-${arch}`,
      binaryName,
    ),
    resolve(
      import.meta.dir,
      "..",
      "..",
      "..",
      "node_modules",
      "electrobun",
      `dist-${platform}-${arch}`,
      binaryName,
    ),
  ];
}

function parsePlatform(value?: string): Platform {
  if (value === "macos" || value === "linux" || value === "win") {
    return value;
  }
  throw new Error(`Invalid platform: ${value ?? "(missing)"}`);
}

function parseArch(value?: string): Arch {
  if (value === "arm64" || value === "x64") {
    return value;
  }
  throw new Error(`Invalid arch: ${value ?? "(missing)"}`);
}

async function resolveZstdPath(
  platform: Platform,
  arch: Arch,
  explicitPath?: string,
): Promise<string> {
  if (explicitPath) {
    const resolvedPath = resolve(explicitPath);
    if (!(await Bun.file(resolvedPath).exists())) {
      throw new Error(`Required binary not found: ${resolvedPath}`);
    }
    return resolvedPath;
  }

  for (const candidate of getDefaultZstdPaths(platform, arch)) {
    if (await Bun.file(candidate).exists()) {
      return candidate;
    }
  }

  throw new Error(
    `Required binary not found. Looked for: ${getDefaultZstdPaths(platform, arch).join(", ")}`,
  );
}

async function validateUpdateJson(args: VerifyUpdaterArtifactArgs): Promise<void> {
  const updateJsonPath = resolve(args.updateJsonPath);
  if (!(await Bun.file(updateJsonPath).exists())) {
    throw new Error(`Update metadata file not found: ${updateJsonPath}`);
  }

  const data: unknown = await Bun.file(updateJsonPath).json();
  if (!isValidUpdateInfo(data)) {
    throw new Error("Invalid update metadata format");
  }

  const validationError = validateUpdateInfo(data, args.version, args.platform, args.arch);
  if (validationError) {
    throw new Error(`Update metadata rejected: ${validationError}`);
  }
}

async function decompressTarball(
  args: VerifyUpdaterArtifactArgs,
  tempDir: string,
): Promise<string> {
  const tarballPath = resolve(args.tarballPath);
  if (!(await Bun.file(tarballPath).exists())) {
    throw new Error(`Updater bundle not found: ${tarballPath}`);
  }

  if (!tarballPath.endsWith(".zst")) {
    return tarballPath;
  }

  const zstdPath = await resolveZstdPath(args.platform, args.arch, args.zstdPath);
  const tarPath = join(tempDir, basename(tarballPath, ".zst"));
  const proc = Bun.spawn(
    [zstdPath, "decompress", "-i", tarballPath, "-o", tarPath, "--no-timing"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Failed to decompress ${tarballPath}`);
  }
  return tarPath;
}

async function extractArchive(tarPath: string, outputDir: string): Promise<void> {
  const archiveBytes = await Bun.file(tarPath).arrayBuffer();
  const archive = new Bun.Archive(archiveBytes);
  await archive.extract(outputDir);
}

export async function verifyUpdaterArtifact(args: VerifyUpdaterArtifactArgs): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "klovi-updater-artifact-"));
  const stagingDir = join(tempDir, "staging");

  try {
    await validateUpdateJson(args);
    const tarPath = await decompressTarball(args, tempDir);
    await extractArchive(tarPath, stagingDir);
    const bundlePath = await validateExtractedBundle(args.platform, stagingDir);
    console.log(`Verified updater artifact: ${bundlePath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    await verifyUpdaterArtifact(parseArgs(Bun.argv));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
