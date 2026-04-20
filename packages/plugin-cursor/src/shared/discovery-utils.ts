import { join } from "node:path";
import { sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

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

export function readFileText(filePath: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.readFileString(filePath);
	});
}

export function fileExists(filePath: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));
	});
}

export function listFilesWithMtime(dir: string, suffix: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const names = yield* fs.readDirectory(dir).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
		const results: FileWithMtime[] = [];

		for (const name of names) {
			if (!name.endsWith(suffix)) {
				continue;
			}

			const info = yield* fs.stat(join(dir, name)).pipe(Effect.catchAll(() => Effect.succeed(null)));
			if (info?.mtime._tag === "Some") {
				results.push({ fileName: name, mtime: info.mtime.value.toISOString() });
			}
		}

		sortByIsoDesc(results, (item) => item.mtime);
		return results;
	});
}
