import { join } from "node:path";
import process from "node:process";
import { sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { FileSystem, type Error as PlatformError } from "@effect/platform";
import { Effect } from "effect";

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//u;

type DirEntry = {
	name: string;
	isDirectory: boolean;
};

type FileWithMtime = {
	fileName: string;
	mtime: string;
};

const STAT_CONCURRENCY = 32;

export function readDirEntriesSafe(dir: string): Effect.Effect<DirEntry[], never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
		const entries = yield* Effect.forEach(
			names,
			(name) =>
				Effect.gen(function* () {
					const info = yield* fs.stat(join(dir, name)).pipe(Effect.catchAll(() => Effect.succeed(null)));
					return info ? ({ name: name, isDirectory: info.type === "Directory" } as DirEntry) : null;
				}),
			{ concurrency: STAT_CONCURRENCY },
		);
		return entries.filter((entry): entry is DirEntry => entry !== null);
	});
}

export function listFilesBySuffix(dir: string, suffix: string): Effect.Effect<string[], never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
		return names.filter((name) => name.endsWith(suffix));
	});
}

export function getLatestMtime(
	dir: string,
	files: readonly string[],
): Effect.Effect<string, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const stats = yield* Effect.forEach(
			files,
			(file) =>
				fs.stat(join(dir, file)).pipe(
					Effect.map((info) => (info.mtime._tag === "Some" ? info.mtime.value.toISOString() : "")),
					Effect.catchAll(() => Effect.succeed("")),
				),
			{ concurrency: STAT_CONCURRENCY },
		);
		let lastActivity = "";
		for (const mtime of stats) {
			if (mtime > lastActivity) {
				lastActivity = mtime;
			}
		}
		return lastActivity;
	});
}

export function listFilesWithMtime(
	dir: string,
	suffix: string,
): Effect.Effect<FileWithMtime[], never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* listFilesBySuffix(dir, suffix);
		const candidates = yield* Effect.forEach(
			names,
			(fileName) =>
				Effect.gen(function* () {
					const info = yield* fs.stat(join(dir, fileName)).pipe(Effect.catchAll(() => Effect.succeed(null)));
					return info?.mtime._tag === "Some"
						? ({ fileName: fileName, mtime: info.mtime.value.toISOString() } as FileWithMtime)
						: null;
				}),
			{ concurrency: STAT_CONCURRENCY },
		);
		const results = candidates.filter((r): r is FileWithMtime => r !== null);
		sortByIsoDesc(results, (item) => item.mtime);
		return results;
	});
}

export function readFileText(
	filePath: string,
): Effect.Effect<string, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.readFileString(filePath);
	});
}

export function fileExists(
	filePath: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.exists(filePath);
	});
}

export function decodeEncodedPath(encoded: string): string {
	// Encoded path has leading dash and dashes for slashes.
	// e.g. "-Users-foo-Workspace-bar" -> "/Users/foo/Workspace/bar"
	// Windows: "-C-Users-foo-bar" -> "C:/Users/foo/bar"
	if (encoded.startsWith("-")) {
		const withSlashes = encoded.slice(1).replace(/-/gu, "/");
		if (process.platform === "win32" && WINDOWS_DRIVE_LETTER_REGEX.test(withSlashes)) {
			return `${withSlashes[0]}:${withSlashes.slice(1)}`;
		}
		return `/${withSlashes}`;
	}
	return encoded.replace(/-/gu, "/");
}
