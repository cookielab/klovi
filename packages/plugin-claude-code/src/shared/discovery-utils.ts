import { join } from "node:path";
import { sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
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

export function readDirEntriesSafe(dir: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
		const entries: DirEntry[] = [];
		for (const name of names) {
			const info = yield* fs.stat(join(dir, name)).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (info) {
				entries.push({ name: name, isDirectory: info.type === "Directory" });
			}
		}
		return entries;
	});
}

export function listFilesBySuffix(dir: string, suffix: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
		return names.filter((name) => name.endsWith(suffix));
	});
}

export function getLatestMtime(dir: string, files: readonly string[]) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		let lastActivity = "";
		for (const file of files) {
			const info = yield* fs.stat(join(dir, file)).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (info?.mtime._tag === "Some") {
				const mtime = info.mtime.value.toISOString();
				if (mtime > lastActivity) {
					lastActivity = mtime;
				}
			}
		}
		return lastActivity;
	});
}

export function listFilesWithMtime(dir: string, suffix: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* listFilesBySuffix(dir, suffix);
		const results: FileWithMtime[] = [];

		for (const fileName of names) {
			const info = yield* fs.stat(join(dir, fileName)).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (info?.mtime._tag === "Some") {
				results.push({ fileName: fileName, mtime: info.mtime.value.toISOString() });
			}
		}

		sortByIsoDesc(results, (item) => item.mtime);
		return results;
	});
}

export function readFileText(filePath: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.readFileString(filePath);
	});
}

export function fileExists(filePath: string) {
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
