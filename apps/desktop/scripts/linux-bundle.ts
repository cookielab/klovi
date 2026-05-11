import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const LINUX_NATIVE_WRAPPER_FILENAMES = ["libNativeWrapper.so", "libNativeWrapper_cef.so"] as const;

const LINUX_LAUNCHER_RELATIVE_PATHS = [
	["launcher"],
	["bin", "launcher"],
	["usr", "lib", "klovi", "bin", "launcher"],
] as const;

const LINUX_LIBRARY_SEARCH_FILENAMES = [...LINUX_NATIVE_WRAPPER_FILENAMES, "libasar.so", "launcher", "bun"] as const;

async function readDirOrEmpty(dir: string): Promise<Dirent<string>[]> {
	try {
		return await readdir(dir, { encoding: "utf8", withFileTypes: true });
	} catch {
		return [];
	}
}

type ScanResult = { matches: string[]; subdirs: string[] };

async function scanDirectory(dir: string, wanted: Set<string>): Promise<ScanResult> {
	const entries = await readDirOrEmpty(dir);
	const matches: string[] = [];
	const subdirs: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			subdirs.push(fullPath);
			continue;
		}
		if ((entry.isFile() || entry.isSymbolicLink()) && wanted.has(entry.name)) {
			matches.push(fullPath);
		}
	}
	return { matches: matches, subdirs: subdirs };
}

async function findNamedFiles(root: string, fileNames: readonly string[]): Promise<string[]> {
	const wanted = new Set(fileNames);
	const allMatches: string[] = [];

	const walk = async (dirs: string[]): Promise<void> => {
		if (dirs.length === 0) {
			return;
		}
		const results = await Promise.all(dirs.map((dir) => scanDirectory(dir, wanted)));
		const nextDirs: string[] = [];
		for (const { matches, subdirs } of results) {
			allMatches.push(...matches);
			nextDirs.push(...subdirs);
		}
		await walk(nextDirs);
	};

	await walk([resolve(root)]);
	return allMatches.sort((a, b) => a.localeCompare(b));
}

async function resolveLinuxLauncherPath(bundlePath: string): Promise<string> {
	const resolvedBundle = resolve(bundlePath);

	const candidates = LINUX_LAUNCHER_RELATIVE_PATHS.map((segments) => join(resolvedBundle, ...segments));
	const existsResults = await Promise.all(candidates.map((candidate) => Bun.file(candidate).exists()));
	const foundIndex = existsResults.findIndex((exists) => exists);
	if (foundIndex >= 0 && candidates[foundIndex] !== undefined) {
		return candidates[foundIndex];
	}

	throw new Error(`Could not find launcher under ${resolvedBundle}`);
}

function resolveLinuxNativeWrapperPaths(bundlePath: string): Promise<string[]> {
	return findNamedFiles(bundlePath, LINUX_NATIVE_WRAPPER_FILENAMES);
}

async function collectLinuxLibrarySearchPaths(bundlePath: string): Promise<string[]> {
	const resolvedBundle = resolve(bundlePath);
	const launcherPath = await resolveLinuxLauncherPath(resolvedBundle);
	const matchedFiles = await findNamedFiles(resolvedBundle, LINUX_LIBRARY_SEARCH_FILENAMES);

	const dirs = new Set<string>([resolvedBundle, dirname(launcherPath)]);
	for (const filePath of matchedFiles) {
		dirs.add(dirname(filePath));
	}

	return [...dirs].sort();
}

export {
	collectLinuxLibrarySearchPaths,
	findNamedFiles,
	LINUX_NATIVE_WRAPPER_FILENAMES,
	resolveLinuxLauncherPath,
	resolveLinuxNativeWrapperPaths,
};
