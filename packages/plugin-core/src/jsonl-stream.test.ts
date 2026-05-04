import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Ref } from "effect";
import { streamJsonl, streamJsonlHead } from "./jsonl-stream.ts";

const testDir = join(tmpdir(), `klovi-jsonl-stream-test-${Date.now()}`);
const fsLayer = NodeFileSystem.layer;

function runFs<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>) {
	return Effect.runPromise(effect.pipe(Effect.provide(fsLayer)) as Effect.Effect<A, E, never>);
}

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("streamJsonlHead", () => {
	test("invokes visitor for each parsed line in order", async () => {
		const filePath = join(testDir, "small.jsonl");
		await Bun.write(
			filePath,
			[JSON.stringify({ a: 1 }), JSON.stringify({ a: 2 }), JSON.stringify({ a: 3 })].join("\n"),
		);

		const seen: number[] = [];
		await runFs(
			streamJsonlHead(filePath, ({ parsed }) => {
				seen.push((parsed as { a: number }).a);
			}),
		);

		expect(seen).toEqual([1, 2, 3]);
	});

	test("bails as soon as visitor returns false", async () => {
		const filePath = join(testDir, "bail.jsonl");
		await Bun.write(
			filePath,
			[JSON.stringify({ a: 1 }), JSON.stringify({ a: 2 }), JSON.stringify({ a: 3 })].join("\n"),
		);

		const seen: number[] = [];
		await runFs(
			streamJsonlHead(filePath, ({ parsed }) => {
				seen.push((parsed as { a: number }).a);
				return false;
			}),
		);

		expect(seen).toEqual([1]);
	});

	test("respects maxLines cap", async () => {
		const filePath = join(testDir, "cap.jsonl");
		const lines = Array.from({ length: 50 }, (_, i) => JSON.stringify({ i: i }));
		await Bun.write(filePath, lines.join("\n"));

		const counter = await runFs(
			Effect.gen(function* () {
				const ref = yield* Ref.make(0);
				yield* streamJsonlHead(
					filePath,
					() => {
						Effect.runSync(Ref.update(ref, (n) => n + 1));
					},
					{ maxLines: 5 },
				);
				return yield* Ref.get(ref);
			}),
		);

		expect(counter).toBe(5);
	});

	test("does not load full file when bailing on line 2 of a large file", async () => {
		const filePath = join(testDir, "large.jsonl");
		// 5 MB synthetic file; metadata in line 2
		const meta = JSON.stringify({ kind: "meta", value: "found" });
		const padding = JSON.stringify({ pad: "x".repeat(1000) });
		const lineCount = 5000;
		const lines = [JSON.stringify({ kind: "header" }), meta, ...Array.from({ length: lineCount }, () => padding)];
		await Bun.write(filePath, lines.join("\n"));

		let found = "";
		const before = process.memoryUsage().heapUsed;
		await runFs(
			streamJsonlHead(filePath, ({ parsed }) => {
				const obj = parsed as { kind?: string; value?: string };
				if (obj.kind === "meta" && obj.value) {
					found = obj.value;
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
				return undefined;
			}),
		);
		const after = process.memoryUsage().heapUsed;

		expect(found).toBe("found");
		// Less than 1 MB allocated for a 5 MB file means we bailed early.
		expect(after - before).toBeLessThan(1024 * 1024);
	});

	test("skips blank lines", async () => {
		const filePath = join(testDir, "blanks.jsonl");
		await Bun.write(filePath, ["", JSON.stringify({ a: 1 }), "", JSON.stringify({ a: 2 }), ""].join("\n"));

		const seen: number[] = [];
		await runFs(
			streamJsonlHead(filePath, ({ parsed }) => {
				seen.push((parsed as { a: number }).a);
			}),
		);

		expect(seen).toEqual([1, 2]);
	});

	test("calls onMalformed for bad JSON and continues", async () => {
		const filePath = join(testDir, "bad.jsonl");
		await Bun.write(filePath, [JSON.stringify({ a: 1 }), "{ not json", JSON.stringify({ a: 3 })].join("\n"));

		const seen: number[] = [];
		const errors: number[] = [];
		await runFs(
			streamJsonlHead(
				filePath,
				({ parsed }) => {
					seen.push((parsed as { a: number }).a);
				},
				{ onMalformed: (_line, lineNumber) => errors.push(lineNumber) },
			),
		);

		expect(seen).toEqual([1, 3]);
		expect(errors).toEqual([2]);
	});
});

describe("streamJsonl", () => {
	test("invokes visitor for every line in a large file without bailing", async () => {
		const filePath = join(testDir, "big.jsonl");
		const lineCount = 2000;
		const lines = Array.from({ length: lineCount }, (_, i) => JSON.stringify({ i: i }));
		await Bun.write(filePath, lines.join("\n"));

		const seen: number[] = [];
		await runFs(
			streamJsonl(filePath, ({ parsed }) => {
				seen.push((parsed as { i: number }).i);
			}),
		);

		expect(seen).toHaveLength(lineCount);
		expect(seen[0]).toBe(0);
		expect(seen[lineCount - 1]).toBe(lineCount - 1);
	});

	test("preserves visit order across chunk boundaries", async () => {
		const filePath = join(testDir, "ordered.jsonl");
		const lines = Array.from({ length: 500 }, (_, i) => JSON.stringify({ i: i, pad: "x".repeat(50) }));
		await Bun.write(filePath, lines.join("\n"));

		const seen: number[] = [];
		await runFs(
			streamJsonl(filePath, ({ parsed }) => {
				seen.push((parsed as { i: number }).i);
			}),
		);

		expect(seen).toEqual(lines.map((_, i) => i));
	});

	test("calls onMalformed for bad lines and continues to the end", async () => {
		const filePath = join(testDir, "messy.jsonl");
		await Bun.write(
			filePath,
			[JSON.stringify({ a: 1 }), "{ broken", JSON.stringify({ a: 3 }), "also-broken", JSON.stringify({ a: 5 })].join(
				"\n",
			),
		);

		const seen: number[] = [];
		const errs: number[] = [];
		await runFs(
			streamJsonl(
				filePath,
				({ parsed }) => {
					seen.push((parsed as { a: number }).a);
				},
				{ onMalformed: (_l, n) => errs.push(n) },
			),
		);
		expect(seen).toEqual([1, 3, 5]);
		expect(errs).toEqual([2, 4]);
	});
});
