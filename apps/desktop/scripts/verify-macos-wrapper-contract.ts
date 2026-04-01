#!/usr/bin/env bun

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

type VerifyArgs = {
	appPath: string;
	zstdPath?: string;
};

type WrapperMetadata = {
	identifier: string;
	name: string;
	channel: string;
	hash: string;
};

const ZSTD_SUFFIX = ".tar.zst";

function parseArgs(argv: string[]): VerifyArgs {
	const args = argv.slice(2);
	let appPath: string | undefined;
	let zstdPath: string | undefined;

	const iter = args[Symbol.iterator]();
	for (const arg of iter) {
		if (arg === "--zstd") {
			const value = iter.next().value;
			if (!value) {
				throw new Error("Missing value for --zstd");
			}
			zstdPath = value;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new Error(`Unknown argument: ${arg}`);
		}
		if (appPath) {
			throw new Error(`Unexpected extra argument: ${arg}`);
		}
		appPath = arg;
	}

	if (!appPath) {
		throw new Error("Usage: bun verify-macos-wrapper-contract.ts <Klovi.app> [--zstd <path>]");
	}

	return zstdPath ? { appPath: appPath, zstdPath: zstdPath } : { appPath: appPath };
}

function getExpectedBundleName(appName: string): string {
	return `${appName}.app`;
}

function parseTarEntries(stdout: string): string[] {
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function assertMetadata(data: unknown): asserts data is WrapperMetadata {
	if (typeof data !== "object" || data === null) {
		throw new Error("Wrapper metadata is not an object");
	}
	const metadata = data as Record<string, unknown>;
	if (
		typeof metadata["identifier"] !== "string" ||
		typeof metadata["name"] !== "string" ||
		typeof metadata["channel"] !== "string" ||
		typeof metadata["hash"] !== "string"
	) {
		throw new Error("Wrapper metadata is missing required fields");
	}
}

function getDefaultZstdPaths(appPath: string): string[] {
	const buildDir = dirname(appPath);
	return [
		join(appPath, "Contents", "MacOS", "zig-zstd"),
		join(buildDir, "..", "..", "node_modules", "electrobun", "dist-macos-arm64", "zig-zstd"),
	].map((path) => resolve(path));
}

async function readMetadata(appPath: string): Promise<WrapperMetadata> {
	const metadataPath = join(appPath, "Contents", "Resources", "metadata.json");
	const raw = await readFile(metadataPath, "utf8");
	const parsed: unknown = JSON.parse(raw);
	assertMetadata(parsed);
	return parsed;
}

async function findEmbeddedArchive(appPath: string): Promise<string> {
	const resourcesDir = join(appPath, "Contents", "Resources");
	const entries = await readdir(resourcesDir);
	const archive = entries.find((entry) => entry.endsWith(ZSTD_SUFFIX));
	if (!archive) {
		throw new Error(`No embedded ${ZSTD_SUFFIX} archive found in ${resourcesDir}`);
	}
	return join(resourcesDir, archive);
}

async function resolveZstdPath(appPath: string, explicitPath?: string): Promise<string> {
	if (explicitPath) {
		const path = resolve(explicitPath);
		if (!(await Bun.file(path).exists())) {
			throw new Error(`Required binary not found: ${path}`);
		}
		return path;
	}

	for (const candidate of getDefaultZstdPaths(appPath)) {
		if (await Bun.file(candidate).exists()) {
			return candidate;
		}
	}

	throw new Error(`Required binary not found. Looked for: ${getDefaultZstdPaths(appPath).join(", ")}`);
}

async function listTarEntries(tarPath: string): Promise<string[]> {
	const proc = Bun.spawn(["tar", "-tf", tarPath], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(stderr.trim() || `tar -tf failed for ${tarPath}`);
	}
	return parseTarEntries(stdout);
}

async function verifyMacOSWrapperContract(args: VerifyArgs): Promise<void> {
	const appPath = resolve(args.appPath);
	const zstdPath = await resolveZstdPath(appPath, args.zstdPath);

	const metadata = await readMetadata(appPath);
	const archivePath = await findEmbeddedArchive(appPath);
	const expectedBundleName = getExpectedBundleName(metadata.name);

	const tempDir = await mkdtemp(join(tmpdir(), "klovi-wrapper-contract-"));
	const tarPath = join(tempDir, basename(archivePath, ZSTD_SUFFIX));

	try {
		const decompressProc = Bun.spawn([zstdPath, "decompress", "-i", archivePath, "-o", tarPath, "--no-timing"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const stderr = await new Response(decompressProc.stderr).text();
		const exitCode = await decompressProc.exited;
		if (exitCode !== 0) {
			throw new Error(stderr.trim() || `Failed to decompress ${archivePath}`);
		}

		const entries = await listTarEntries(tarPath);
		const topLevelEntries = new Set(
			entries.map((entry) => entry.split("/")[0]).filter((entry): entry is string => Boolean(entry)),
		);
		if (!topLevelEntries.has(expectedBundleName)) {
			const actualBundleNames = [...topLevelEntries].filter((entry) => entry.endsWith(".app"));
			const actualSummary = actualBundleNames.length > 0 ? actualBundleNames.join(", ") : "(no .app entries found)";
			throw new Error(`wrapper expects ${expectedBundleName} but tar contains ${actualSummary}`);
		}
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	try {
		await verifyMacOSWrapperContract(parseArgs(Bun.argv));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export { getExpectedBundleName, parseArgs, parseTarEntries, verifyMacOSWrapperContract };
