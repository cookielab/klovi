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

import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI argument parsing (exported for testing)
// ---------------------------------------------------------------------------

type ParsedArgs = {
	tarball: string;
	arch: "x64" | "arm64";
	version: string;
	output: string;
};

function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2); // skip bun + script path

	let tarball: string | undefined;
	let arch: string | undefined;
	let version: string | undefined;
	let output: string | undefined;

	const iter = args[Symbol.iterator]();
	for (const arg of iter) {
		switch (arg) {
			case "--tarball":
				tarball = iter.next().value;
				break;
			case "--arch":
				arch = iter.next().value;
				break;
			case "--version":
				version = iter.next().value;
				break;
			case "--output":
				output = iter.next().value;
				break;
			default:
				fail(`Unknown argument: ${arg}`);
		}
	}

	if (!tarball) {
		fail("Missing required argument: --tarball");
	}
	if (!arch) {
		fail("Missing required argument: --arch");
	}
	if (!version) {
		fail("Missing required argument: --version");
	}
	if (!output) {
		fail("Missing required argument: --output");
	}

	if (arch !== "x64" && arch !== "arm64") {
		fail(`Invalid arch "${arch}". Must be x64 or arm64.`);
	}

	return { tarball: tarball, arch: arch, version: version, output: output };
}

function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Architecture mapping (exported for testing)
// ---------------------------------------------------------------------------

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

const APPIMAGE_ARCH_MAP: Record<string, string> = {
	x64: "x86_64",
	arm64: "aarch64",
};

const APPIMAGE_DESKTOP_ENTRY_FILENAME = "io.cookielab.klovi.desktop";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function run(cmd: string[], opts?: { cwd?: string }): Promise<void> {
	console.log(`$ ${cmd.join(" ")}`);
	const proc = Bun.spawn(cmd, {
		...(opts?.cwd ? { cwd: opts.cwd } : {}),
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

const APPIMAGE_TOOL_BASE_URL = "https://github.com/AppImage/appimagetool/releases/latest/download";

const APPRUN_CONTENT = `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/usr/lib/klovi/bin/launcher" "$@"
`;

const DESKTOP_ENTRY = `[Desktop Entry]
Name=Klovi
Comment=Desktop viewer for AI coding sessions
Exec=klovi %U
Icon=klovi
Type=Application
Categories=Development;
StartupWMClass=Klovi
X-GNOME-WMClass=Klovi
Terminal=false
`;

async function main(): Promise<void> {
	const { tarball, arch, version, output } = parseArgs(Bun.argv);

	const tarballPath = resolve(tarball);
	const outputPath = resolve(output);
	const workDir = join(dirname(outputPath), `.appimage-work-${Date.now()}`);
	const appDir = join(workDir, "Klovi.AppDir");
	const appLibDir = join(appDir, "usr", "lib", "klovi");
	const appBinDir = join(appDir, "usr", "bin");
	const extractDir = join(workDir, "extracted");

	console.log(`Packaging AppImage for ${arch} v${version}`);
	console.log(`  tarball : ${tarballPath}`);
	console.log(`  output  : ${outputPath}`);
	console.log(`  workDir : ${workDir}`);

	// 1. Create working directories
	await ensureDir(extractDir);
	await ensureDir(appLibDir);
	await ensureDir(appBinDir);

	// 2. Decompress .tar.zst using system tar (Ubuntu 24.04 CI has zstd support)
	console.log("\nStep 1: Extract .tar.zst...");
	await run(["tar", "--zstd", "-xf", tarballPath, "-C", extractDir]);

	// 3. Find the top-level bundle directory from extracted output
	const extractedEntries = readdirSync(extractDir);
	const [bundleDir] = extractedEntries;
	if (!bundleDir) {
		fail("Tarball extracted to empty directory");
	}
	const bundlePath = join(extractDir, bundleDir);
	console.log(`  Found bundle: ${bundleDir}`);

	// 4. Build AppDir layout
	console.log("\nStep 2: Build AppDir layout...");

	// Place extracted bundle under usr/lib/klovi/
	await run(["sh", "-c", `cp -a "${bundlePath}"/. "${appLibDir}/"`]);

	// Create usr/bin/klovi as a launcher wrapper
	const launcherWrapper = `#!/bin/bash
HERE="$(dirname "$(readlink -f "\${0}")")"
exec "\${HERE}/../lib/klovi/bin/launcher" "$@"
`;
	await Bun.write(join(appBinDir, "klovi"), launcherWrapper);
	await run(["chmod", "+x", join(appBinDir, "klovi")]);

	// 5. Create AppRun
	const appRunPath = join(appDir, "AppRun");
	await Bun.write(appRunPath, APPRUN_CONTENT);
	await run(["chmod", "+x", appRunPath]);

	// 6. Create .desktop file
	await Bun.write(join(appDir, APPIMAGE_DESKTOP_ENTRY_FILENAME), DESKTOP_ENTRY);

	// 7. Copy icon
	const iconSource = join(import.meta.dir, "..", "icon.iconset", "icon_256x256.png");
	const iconFile = Bun.file(iconSource);
	if (!(await iconFile.exists())) {
		fail(`Icon not found at: ${iconSource}`);
	}
	await Bun.write(join(appDir, "klovi.png"), iconFile);
	await Bun.write(join(appDir, ".DirIcon"), iconFile);

	// 8. Download appimagetool (architecture derived from --arch)
	console.log("\nStep 3: Download appimagetool...");
	const appImageArch = APPIMAGE_ARCH_MAP[arch] ?? fail(`Unsupported arch: ${arch}`);
	const toolUrl = `${APPIMAGE_TOOL_BASE_URL}/appimagetool-${appImageArch}.AppImage`;
	const toolPath = join(workDir, "appimagetool");

	console.log(`  Downloading ${toolUrl}`);
	const response = await fetch(toolUrl);
	if (!response.ok) {
		fail(`Failed to download appimagetool: ${response.status} ${response.statusText}`);
	}
	// Use arrayBuffer() to fully download before writing — streaming a Response
	// directly via Bun.write() can silently fail on some CI environments.
	const toolBytes = await response.arrayBuffer();
	console.log(`  Downloaded ${toolBytes.byteLength} bytes`);
	await Bun.write(toolPath, toolBytes);
	await run(["chmod", "+x", toolPath]);

	// 9. Build the AppImage
	console.log("\nStep 4: Build AppImage...");
	await ensureDir(dirname(outputPath));

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

	// 10. Cleanup
	console.log("\nStep 5: Cleanup...");
	await run(["rm", "-rf", workDir]);

	// 11. Done
	const outputFile = Bun.file(outputPath);
	if (!(await outputFile.exists())) {
		fail(`AppImage was not created at: ${outputPath}`);
	}

	const { size } = outputFile;
	console.log("\nAppImage created successfully!");
	console.log(`  Path: ${outputPath}`);
	console.log(`  Size: ${(size / BYTES_PER_MB).toFixed(1)} MB`);
}

// Only run main when executed directly, not when imported for testing.
// Use top-level await so Bun's event loop stays alive during async I/O
// (fetch, file writes). A bare main().catch() can let the process exit
// before the promise chain settles.
if (import.meta.main) {
	try {
		await main();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

export type { ParsedArgs };
export { APPIMAGE_ARCH_MAP, APPIMAGE_DESKTOP_ENTRY_FILENAME, DESKTOP_ENTRY, parseArgs };
