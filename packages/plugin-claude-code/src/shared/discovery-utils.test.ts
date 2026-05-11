import { mkdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import type { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import {
	decodeEncodedPath,
	getLatestMtime,
	listFilesBySuffix,
	listFilesWithMtime,
	readDirEntriesSafe,
} from "./discovery-utils";

const testDir = join(tmpdir(), `klovi-claude-discovery-utils-test-${Date.now()}`);
const originalPlatform = process.platform;

const fsLayer = NodeFileSystem.layer;

function runFs<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(fsLayer)) as Effect.Effect<A, E, never>);
}

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	Object.defineProperty(process, "platform", { value: originalPlatform });
	await rm(testDir, { recursive: true, force: true });
});

describe("claude discovery utils", () => {
	it("readDirEntriesSafe returns [] for missing directory", async () => {
		const entries = await runFs(readDirEntriesSafe(join(testDir, "missing")));
		expect(entries).toEqual([]);
	});

	it("listFilesBySuffix filters matching files", async () => {
		await Bun.write(join(testDir, "a.jsonl"), "{}");
		await Bun.write(join(testDir, "b.txt"), "x");
		await Bun.write(join(testDir, "c.jsonl"), "{}");

		const files = await runFs(listFilesBySuffix(testDir, ".jsonl"));
		expect(files.sort()).toEqual(["a.jsonl", "c.jsonl"]);
	});

	it("getLatestMtime returns newest mtime and tolerates missing file", async () => {
		const first = join(testDir, "a.jsonl");
		const second = join(testDir, "b.jsonl");

		await Bun.write(first, "{}");
		await Bun.write(second, "{}");
		await utimes(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
		await utimes(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

		const latest = await runFs(getLatestMtime(testDir, ["missing.jsonl", "a.jsonl", "b.jsonl"]));
		expect(latest).toBe("2025-01-15T00:00:00.000Z");
	});

	it("listFilesWithMtime returns descending mtime order", async () => {
		const first = join(testDir, "a.jsonl");
		const second = join(testDir, "b.jsonl");

		await Bun.write(first, "{}");
		await Bun.write(second, "{}");
		await utimes(first, new Date("2025-01-14T00:00:00.000Z"), new Date("2025-01-14T00:00:00.000Z"));
		await utimes(second, new Date("2025-01-15T00:00:00.000Z"), new Date("2025-01-15T00:00:00.000Z"));

		const files = await runFs(listFilesWithMtime(testDir, ".jsonl"));
		expect(files.map((f) => f.fileName)).toEqual(["b.jsonl", "a.jsonl"]);
	});

	it("decodeEncodedPath decodes unix-style encoded paths", () => {
		expect(decodeEncodedPath("-Users-dev-project")).toBe("/Users/dev/project");
		expect(decodeEncodedPath("Users-dev-project")).toBe("Users/dev/project");
	});

	it("decodeEncodedPath decodes windows drive format when running on win32", () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		expect(decodeEncodedPath("-C-Users-dev-project")).toBe("C:/Users/dev/project");
	});
});
