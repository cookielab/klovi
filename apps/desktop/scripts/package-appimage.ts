#!/usr/bin/env bun

/**
 * Linux AppImage packaging script.
 *
 * Converts Electrobun's normalized Linux tarball (.tar.zst) into an AppImage
 * using appimagetool. Intended for CI release builds.
 *
 * Usage:
 *   bun run package-appimage.ts \
 *     --tarball <path-to-.tar.zst> \
 *     --arch <x64|arm64> \
 *     --version <semver> \
 *     --output <output-appimage-path>
 */

import { join, dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
	tarball: string;
	arch: "x64" | "arm64";
	version: string;
	output: string;
} {
	const args = argv.slice(2); // skip bun + script path

	let tarball: string | undefined;
	let arch: string | undefined;
	let version: string | undefined;
	let output: string | undefined;

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--tarball":
				tarball = args[++i];
				break;
			case "--arch":
				arch = args[++i];
				break;
			case "--version":
				version = args[++i];
				break;
			case "--output":
				output = args[++i];
				break;
			default:
				fail(`Unknown argument: ${args[i]}`);
		}
	}

	if (!tarball) fail("Missing required argument: --tarball");
	if (!arch) fail("Missing required argument: --arch");
	if (!version) fail("Missing required argument: --version");
	if (!output) fail("Missing required argument: --output");

	if (arch !== "x64" && arch !== "arm64") {
		fail(`Invalid arch "${arch}". Must be x64 or arm64.`);
	}

	return { tarball, arch, version, output };
}

function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function run(cmd: string[], opts?: { cwd?: string }): Promise<void> {
	console.log(`$ ${cmd.join(" ")}`);
	const proc = Bun.spawn(cmd, {
		cwd: opts?.cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		fail(`Command failed with exit code ${exitCode}: ${cmd.join(" ")}`);
	}
}

async function ensureDir(path: string): Promise<void> {
	await run(["mkdir", "-p", path]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const APPIMAGE_TOOL_BASE_URL =
	"https://github.com/AppImage/appimagetool/releases/latest/download";

const ARCH_MAP: Record<string, string> = {
	x64: "x86_64",
	arm64: "aarch64",
};

const APPRUN_CONTENT = `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/usr/opt/klovi/bin/launcher" "$@"
`;

const DESKTOP_ENTRY = `[Desktop Entry]
Name=Klovi
Comment=Desktop viewer for AI coding sessions
Exec=klovi %U
Icon=klovi
Type=Application
Categories=Development;
StartupWMClass=klovi
Terminal=false
`;

async function main(): Promise<void> {
	const { tarball, arch, version, output } = parseArgs(Bun.argv);

	const tarballPath = resolve(tarball);
	const outputPath = resolve(output);
	const workDir = join(dirname(outputPath), `.appimage-work-${Date.now()}`);
	const appDir = join(workDir, "Klovi.AppDir");
	const appOptDir = join(appDir, "usr", "opt", "klovi");
	const extractDir = join(workDir, "extracted");

	console.log(`Packaging AppImage for ${arch} v${version}`);
	console.log(`  tarball : ${tarballPath}`);
	console.log(`  output  : ${outputPath}`);
	console.log(`  workDir : ${workDir}`);

	// 1. Create working directories
	await ensureDir(extractDir);
	await ensureDir(appOptDir);

	// 2. Extract the .tar.zst to a temporary location to get zig-zstd
	//    First we need to do a raw extraction to get the zig-zstd binary.
	//    Use tar with --zstd if available, or decompress in two steps.
	//    We'll do a two-step approach: decompress .zst → .tar, then extract.

	const tarFile = join(workDir, "bundle.tar");

	// Try extracting with tar --zstd first (needs zstd installed), fall back to
	// manual decompression with zig-zstd from inside the archive.
	// Since zig-zstd is INSIDE the tarball, we need an initial extraction.
	// Strategy: use Bun to do the initial .tar.zst extraction directly.

	// Actually, the requirement says to use zig-zstd found next to the
	// extracted bin/launcher. So we need a bootstrap: extract the .tar.zst
	// using system tar (which on most Linux CI supports --zstd), get zig-zstd,
	// then we already have the extracted files.
	//
	// Simpler approach: decompress .tar.zst → .tar using the system `zstd`
	// command or `tar --zstd`, then extract.
	//
	// Per the requirement: use zig-zstd. To bootstrap, we'll first do a
	// partial extract or decompress with whatever is available, then use
	// zig-zstd for the actual decompression.
	//
	// Cleanest interpretation: decompress the .tar.zst using zig-zstd.
	// But zig-zstd is inside the archive. The solution is:
	//   1. Copy the tarball
	//   2. Use `tar -xf` on the .tar.zst (system tar can handle zstd on modern Linux)
	//      to extract only bin/zig-zstd
	//   3. Use zig-zstd to decompress the full .tar.zst → .tar
	//   4. Extract the .tar
	//
	// Let's implement this bootstrap approach.

	console.log("\nStep 1: Bootstrap — extract zig-zstd from tarball...");

	// Extract just bin/zig-zstd using system tar (modern Linux tar supports zstd)
	try {
		await run(
			[
				"tar",
				"--zstd",
				"-xf",
				tarballPath,
				"-C",
				extractDir,
				"bin/zig-zstd",
			],
			{ cwd: workDir },
		);
	} catch {
		// Fallback: try without --zstd flag (some tar versions auto-detect)
		await run(["tar", "-xf", tarballPath, "-C", extractDir, "bin/zig-zstd"], {
			cwd: workDir,
		});
	}

	const zigZstd = join(extractDir, "bin", "zig-zstd");

	// Ensure zig-zstd is executable
	await run(["chmod", "+x", zigZstd]);

	// 3. Decompress .tar.zst → .tar using zig-zstd
	console.log("\nStep 2: Decompress .tar.zst → .tar using zig-zstd...");
	await run([zigZstd, "-d", tarballPath, "-o", tarFile]);

	// 4. Extract the .tar into extractDir
	console.log("\nStep 3: Extract .tar...");
	// Clear extractDir first to avoid duplication from the bootstrap step
	await run(["rm", "-rf", extractDir]);
	await ensureDir(extractDir);
	await run(["tar", "-xf", tarFile, "-C", extractDir]);

	// 5. Move all extracted files into the AppDir structure
	console.log("\nStep 4: Build AppDir layout...");

	// Copy all extracted content into usr/opt/klovi/
	await run(["sh", "-c", `cp -a "${extractDir}"/. "${appOptDir}/"`]);

	// 6. Create AppRun
	const appRunPath = join(appDir, "AppRun");
	await Bun.write(appRunPath, APPRUN_CONTENT);
	await run(["chmod", "+x", appRunPath]);

	// 7. Create .desktop file
	await Bun.write(join(appDir, "klovi.desktop"), DESKTOP_ENTRY);

	// 8. Copy icon
	const iconSource = join(import.meta.dir, "..", "icon.iconset", "icon_256x256.png");
	const iconDest = join(appDir, "klovi.png");

	const iconFile = Bun.file(iconSource);
	if (!(await iconFile.exists())) {
		fail(`Icon not found at: ${iconSource}`);
	}
	await Bun.write(iconDest, iconFile);

	// 9. Download appimagetool
	console.log("\nStep 5: Download appimagetool...");
	const appImageArch = ARCH_MAP[arch];
	const toolUrl = `${APPIMAGE_TOOL_BASE_URL}/appimagetool-${appImageArch}.AppImage`;
	const toolPath = join(workDir, "appimagetool");

	console.log(`  Downloading ${toolUrl}`);
	const response = await fetch(toolUrl);
	if (!response.ok) {
		fail(`Failed to download appimagetool: ${response.status} ${response.statusText}`);
	}
	await Bun.write(toolPath, response);
	await run(["chmod", "+x", toolPath]);

	// 10. Build the AppImage
	console.log("\nStep 6: Build AppImage...");

	// Ensure output directory exists
	await ensureDir(dirname(outputPath));

	// Set ARCH env for appimagetool
	const appImageToolEnv = { ...process.env, ARCH: appImageArch };
	const buildProc = Bun.spawn([toolPath, appDir, outputPath], {
		cwd: workDir,
		stdout: "inherit",
		stderr: "inherit",
		env: appImageToolEnv,
	});
	const buildExitCode = await buildProc.exited;
	if (buildExitCode !== 0) {
		fail(`appimagetool failed with exit code ${buildExitCode}`);
	}

	// 11. Cleanup
	console.log("\nStep 7: Cleanup...");
	await run(["rm", "-rf", workDir]);

	// 12. Done
	const outputFile = Bun.file(outputPath);
	if (!(await outputFile.exists())) {
		fail(`AppImage was not created at: ${outputPath}`);
	}

	const size = outputFile.size;
	console.log(`\nAppImage created successfully!`);
	console.log(`  Path: ${outputPath}`);
	console.log(`  Size: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
