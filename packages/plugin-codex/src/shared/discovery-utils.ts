import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//u;

type DirEntry = {
	name: string;
	isDirectory: boolean;
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
