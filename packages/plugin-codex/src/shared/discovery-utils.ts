import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//;

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export function readDirEntriesSafe(dir: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs
      .readDirectory(dir)
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])));
    const entries: DirEntry[] = [];
    for (const name of names) {
      const info = yield* fs
        .stat(join(dir, name))
        .pipe(Effect.catchAll(() => Effect.succeed(null)));
      if (info) {
        entries.push({ name, isDirectory: info.type === "Directory" });
      }
    }
    return entries;
  });
}

export function readTextPrefix(filePath: string, maxBytes: number) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const bytes = yield* fs.readFile(filePath);
    const slice = bytes.subarray(0, maxBytes);
    return new TextDecoder().decode(slice);
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
    const withSlashes = encoded.slice(1).replace(/-/g, "/");
    if (process.platform === "win32" && WINDOWS_DRIVE_LETTER_REGEX.test(withSlashes)) {
      return `${withSlashes[0]}:${withSlashes.slice(1)}`;
    }
    return `/${withSlashes}`;
  }
  return encoded.replace(/-/g, "/");
}
