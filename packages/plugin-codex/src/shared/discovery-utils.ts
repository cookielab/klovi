import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//u;

type DirEntry = {
	name: string;
	isDirectory: boolean;
};

const STAT_CONCURRENCY = 32;

export function readDirEntriesSafe(dir: string) {
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
	if (encoded.startsWith("-")) {
		const withSlashes = encoded.slice(1).replace(/-/gu, "/");
		if (process.platform === "win32" && WINDOWS_DRIVE_LETTER_REGEX.test(withSlashes)) {
			return `${withSlashes[0]}:${withSlashes.slice(1)}`;
		}
		return `/${withSlashes}`;
	}
	return encoded.replace(/-/gu, "/");
}
