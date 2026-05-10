import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { decodeEncodedPath, readDirEntriesSafe } from "./discovery-utils";

const testDir = join(tmpdir(), `klovi-codex-discovery-utils-test-${Date.now()}`);
const originalPlatform = process.platform;

const testLayer = NodeFileSystem.layer;

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	Object.defineProperty(process, "platform", { value: originalPlatform });
	await rm(testDir, { recursive: true, force: true });
});

describe("codex discovery utils", () => {
	it("readDirEntriesSafe returns [] for missing directory", async () => {
		const entries = await Effect.runPromise(
			readDirEntriesSafe(join(testDir, "missing")).pipe(Effect.provide(testLayer)),
		);
		expect(entries).toEqual([]);
	});

	it("decodeEncodedPath supports unix-style paths", () => {
		expect(decodeEncodedPath("-Users-dev-project")).toBe("/Users/dev/project");
		expect(decodeEncodedPath("Users-dev-project")).toBe("Users/dev/project");
	});

	it("decodeEncodedPath supports windows-style drive paths", () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		expect(decodeEncodedPath("-D-Workspace-klovi")).toBe("D:/Workspace/klovi");
	});
});
