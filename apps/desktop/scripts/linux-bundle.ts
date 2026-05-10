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

async function findNamedFiles(root: string, fileNames: readonly string[]): Promise<string[]> {
	const pending = [resolve(root)];
	const matches: string[] = [];
	const wanted = new Set(fileNames);

	while (pending.length > 0) {
		const dir = pending.pop();
		if (!dir) {
			continue;
		}

		let entries: Dirent<string>[];
		try {
			entries = await readdir(dir, { encoding: "utf8", withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				pending.push(fullPath);
				continue;
			}

			if ((entry.isFile() || entry.isSymbolicLink()) && wanted.has(entry.name)) {
				matches.push(fullPath);
			}
		}
	}

	return matches.sort((a, b) => a.localeCompare(b));
}

async function resolveLinuxLauncherPath(bundlePath: string): Promise<string> {
	const resolvedBundle = resolve(bundlePath);

	for (const segments of LINUX_LAUNCHER_RELATIVE_PATHS) {
		const candidate = join(resolvedBundle, ...segments);
		if (await Bun.file(candidate).exists()) {
			return candidate;
		}
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
