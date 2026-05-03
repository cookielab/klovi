# Many-Sessions Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Klovi feel responsive for users with many sessions through cheaper reads, parallelism, two-phase session-load RPC, and virtualized rendering — without introducing new caches.

**Architecture:** Six independent sub-sections in dependency order: §1 streaming metadata reads (new `streamJsonlHead` primitive in `plugin-core`), §2 bounded parallelism with `Effect.forEach`, §3a server-side streaming parse, §4a virtualize `MessageList`, §3b two-phase RPC (`getSessionHead`/`getSessionTail`), §4b virtualize `SessionList` and `ProjectList`. §4a precedes §3b so the tail-append path lands on a virtualized list from day one.

**Tech Stack:** Effect 3.21.2, `@effect/platform@0.96.1` (`FileSystem.stream` returning `Stream<Uint8Array, PlatformError>`), Bun, React 19, `@tanstack/react-virtual` (NEW dep — ~3 KB gzip), TypeScript strict mode (`noUncheckedIndexedAccess`), `NodeFileSystem.layer` from `@effect/platform-node` for tests, `bun:test` + `@testing-library/react` + happy-dom v20.

**Spec:** `docs/superpowers/specs/2026-05-04-many-sessions-perf-design.md`

**Hard constraint (from CLAUDE.md):** No caching. No in-memory caches, file-based caches, DB cache tables, HTTP cache layers, memoization caches, or TTL-based cache logic. The pre-existing `stats-cache.json` is NOT modified or extended in this round.

---

## File Structure

### NEW files

| File | Responsibility |
|---|---|
| `packages/plugin-core/src/jsonl-stream.ts` | `streamJsonlHead` (bail-early, line cap) and `streamJsonl` (full file) — the only new primitives. Both built on `FileSystem.stream`. |
| `packages/plugin-core/src/jsonl-stream.test.ts` | Tests for both primitives using `NodeFileSystem.layer`. |
| `packages/server/src/services/sessions-service.test.ts` | Tests for `getSessionHead` / `getSessionTail` slicing. |
| `packages/ui/src/app/hooks/useSessionData.test.tsx` | Tests for the two-phase client behaviour (uses `MockProviders` JSX wrapper, hence `.tsx`). |
| `packages/ui-components/src/sessions/SessionList.test.tsx` | Render tests for the virtualized session list. |

### MODIFIED files

| File | Change |
|---|---|
| `packages/plugin-core/src/index.ts` | Export `streamJsonlHead`, `streamJsonl`, and the `JsonlLineContext` type. |
| `packages/plugin-core/src/plugin-registry.ts` | Replace sequential `discoverPluginStates` loop with `Effect.forEach({ concurrency: "unbounded" })`. |
| `packages/plugin-claude-code/src/discovery.ts` | Migrate `extractCwd` and `extractSessionMeta` to `streamJsonlHead`; parallelize project & session loops with `Effect.forEach({ concurrency: 16 })`; refactor `inspectProjectSessions` to read newest-first only. |
| `packages/plugin-claude-code/src/shared/discovery-utils.ts` | Parallelize `readDirEntriesSafe` and `listFilesWithMtime` (`fs.stat` concurrency 32); remove `readTextPrefix`. |
| `packages/plugin-claude-code/src/parser.ts` | Replace `readJsonlLines` body to use `streamJsonl`; drop `readFileText` import. |
| `packages/plugin-codex/src/discovery.ts` | Replace the `readTextPrefix` call with `streamJsonlHead`; parallelize `listCodexSessions` loop. |
| `packages/plugin-codex/src/session-index.ts` | Replace `readTextPrefix` and `iterateJsonl` in `parseSessionMeta`/`inferModelFromPrefix` with `streamJsonlHead`. |
| `packages/plugin-codex/src/shared/discovery-utils.ts` | Parallelize `readDirEntriesSafe`; remove `readTextPrefix`. |
| `packages/plugin-codex/src/shared/discovery-utils.test.ts` | Drop the now-removed `readTextPrefix` test and import. |
| `packages/server/src/services/sessions-service.ts` | Add `getSessionHead` / `getSessionTail` exports built on shared `loadSessionInternal`; keep `getSession` as a thin compose for back-compat. |
| `packages/server/src/effect/server-services.ts` | Extend `KloviServicesShape` with `getSessionHead` and `getSessionTail`; wire to the new functions. |
| `apps/desktop/src/bun/rpc-handlers.ts` | Add `getSessionHeadHandler` and `getSessionTailHandler`; export them. |
| `packages/ui/src/shared/desktop-contract.ts` | Add `getSessionHead` and `getSessionTail` `DesktopRequestDefinition` entries. |
| `packages/ui/src/shared/types.ts` | Add `SessionHeadResponse` / `SessionTailResponse` types. |
| `packages/ui/src/lib/rpc-client.ts` | Add `getSessionHead` and `getSessionTail` to the Effect-based `kloviClient` singleton. |
| `packages/ui/src/app/test-helpers/mock-rpc.ts` | Add default `getSessionHead`/`getSessionTail` mocks so existing component tests don't break. |
| `packages/ui/src/app/hooks/useSessionData.ts` | Fire head + tail in parallel via `useKloviRuntime` + `useEffectQuery`; render head immediately; append tail on arrival. |
| `packages/ui-components/src/messages/MessageList.tsx` | Virtualize with `useVirtualizer({ measureElement })`; preserve scroll on tail-append; `scrollToIndex` on `visibleSubSteps` change. |
| `packages/ui-components/src/sessions/SessionList.tsx` | Virtualize with fixed `estimateSize: 56`. |
| `packages/ui-components/src/sessions/ProjectList.tsx` | Virtualize the filtered slice with fixed `estimateSize: 56`. |
| `packages/ui-components/package.json` | Add `@tanstack/react-virtual` dependency. |
| `test-setup.ts` | Add `ResizeObserver` shim (no-op) so `useVirtualizer`'s `measureElement` survives in happy-dom. |

### EXPLICITLY OUT OF SCOPE (deferred to follow-ups)

- `packages/plugin-cursor/src/parser.ts` — does not call `readTextPrefix`; full-file parses can adopt `streamJsonl` opportunistically later.
- `packages/plugin-codex/src/parser.ts` — same shape as `loadClaudeSession`, deferred until Claude Code session-open pain is measured against §3a.
- Consolidating the two `readTextPrefix` copies into `plugin-core` (both are removed in this round; consolidation is no longer necessary).
- The pre-existing `stats-cache.json` and its companion code (untouched).
- Pain F (re-navigation cost) — needs shared in-memory state across navigation, conflicts with the no-caching rule.

---

## §1 — Bail-early streaming metadata read

**Goal:** Replace the fake `maxBytes` cap in `readTextPrefix` with `streamJsonlHead`, an Effect-Stream primitive that closes the file handle as soon as the visitor returns `false`.

### Task 1.1: Add `streamJsonlHead` primitive in `plugin-core`

**Files:**
- Create: `packages/plugin-core/src/jsonl-stream.ts`
- Create: `packages/plugin-core/src/jsonl-stream.test.ts`

- [ ] **Step 1: Write the failing test for `streamJsonlHead`**

Create `packages/plugin-core/src/jsonl-stream.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Ref } from "effect";
import { streamJsonlHead } from "./jsonl-stream.ts";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/plugin-core && bun test src/jsonl-stream.test.ts`
Expected: FAIL — `Cannot find module './jsonl-stream.ts'`.

- [ ] **Step 3: Implement `streamJsonlHead`**

Create `packages/plugin-core/src/jsonl-stream.ts`:

```ts
import { FileSystem, type PlatformError } from "@effect/platform";
import { Effect, Ref, Stream } from "effect";

type JsonlLineContext = {
	parsed: unknown;
	line: string;
	lineIndex: number;
	lineNumber: number;
};

type JsonlVisitor = (context: JsonlLineContext) => unknown;

type StreamJsonlHeadOptions = {
	maxLines?: number;
	chunkSize?: number;
	onMalformed?: (line: string, lineNumber: number, error: unknown) => void;
};

const DEFAULT_HEAD_CHUNK_SIZE = 8 * 1024;

function streamJsonlHead(
	filePath: string,
	visitor: JsonlVisitor,
	options: StreamJsonlHeadOptions = {},
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const indexRef = yield* Ref.make(0);
		const bailedRef = yield* Ref.make(false);
		const chunkSize = options.chunkSize ?? DEFAULT_HEAD_CHUNK_SIZE;

		const baseStream = fs.stream(filePath, { chunkSize: chunkSize });
		const linesStream = baseStream.pipe(Stream.decodeText("utf-8"), Stream.splitLines);
		const cappedStream = options.maxLines === undefined ? linesStream : linesStream.pipe(Stream.take(options.maxLines));

		yield* cappedStream.pipe(
			Stream.takeUntilEffect(() => Ref.get(bailedRef)),
			Stream.runForEach((line) =>
				Effect.gen(function* () {
					const lineIndex = yield* Ref.getAndUpdate(indexRef, (n) => n + 1);
					const trimmed = line.trim();
					if (!trimmed) {
						return;
					}
					const lineNumber = lineIndex + 1;
					try {
						const parsed = JSON.parse(line);
						const result = visitor({ parsed: parsed, line: line, lineIndex: lineIndex, lineNumber: lineNumber });
						if (result === false) {
							yield* Ref.set(bailedRef, true);
						}
					} catch (error) {
						options.onMalformed?.(line, lineNumber, error);
					}
				}),
			),
		);
	});
}

export type { JsonlLineContext, JsonlVisitor, StreamJsonlHeadOptions };
export { streamJsonlHead };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/plugin-core && bun test src/jsonl-stream.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run lint, typecheck, and full plugin-core tests**

Run: `cd packages/plugin-core && bun run lint && bun run typecheck && bun test`
Expected: all pass. Fix any complaints (Biome may want sorted keys/single-quote/whitespace tweaks).

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-core/src/jsonl-stream.ts packages/plugin-core/src/jsonl-stream.test.ts
git commit -m "feat(plugin-core): add streamJsonlHead primitive for bail-early metadata reads"
```

### Task 1.2: Export `streamJsonlHead` from `plugin-core`

**Files:**
- Modify: `packages/plugin-core/src/index.ts`

- [ ] **Step 1: Add export**

Open `packages/plugin-core/src/index.ts` and insert (alphabetical position, between `iso-time` and `plugin-config`):

```ts
export type { JsonlLineContext, JsonlVisitor, StreamJsonlHeadOptions } from "./jsonl-stream.ts";
export { streamJsonlHead } from "./jsonl-stream.ts";
```

- [ ] **Step 2: Verify the export resolves**

Run: `cd packages/plugin-core && bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/plugin-core/src/index.ts
git commit -m "feat(plugin-core): export streamJsonlHead from package entry"
```

### Task 1.3: Migrate `extractCwd` and `extractSessionMeta` in plugin-claude-code

**Files:**
- Modify: `packages/plugin-claude-code/src/discovery.ts`
- Test: `packages/plugin-claude-code/src/discovery.test.ts` (existing tests must stay green)

- [ ] **Step 1: Run existing discovery tests as a baseline**

Run: `cd packages/plugin-claude-code && bun test src/discovery.test.ts`
Expected: PASS (capture the output to compare after the change).

- [ ] **Step 2: Replace `extractCwd` to use `streamJsonlHead`**

In `packages/plugin-claude-code/src/discovery.ts`, replace the import line:

```ts
import {
	decodeEncodedPath,
	listFilesBySuffix,
	listFilesWithMtime,
	readDirEntriesSafe,
	readTextPrefix,
} from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";
```

with:

```ts
import { streamJsonlHead } from "@cookielab.io/klovi-plugin-core";
import {
	decodeEncodedPath,
	listFilesBySuffix,
	listFilesWithMtime,
	readDirEntriesSafe,
} from "./shared/discovery-utils.ts";
```

Then replace the `extractCwd` body:

```ts
function extractCwd(filePath: string) {
	return Effect.gen(function* () {
		let cwd = "";
		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				const obj = parsed as RawLine;
				if (obj.cwd) {
					({ cwd } = obj);
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return needed for TypeScript
				return undefined;
			},
			{ maxLines: 20 },
		).pipe(Effect.catchAll(() => Effect.void));
		return cwd;
	});
}
```

- [ ] **Step 3: Replace `extractSessionMeta` to use `streamJsonlHead`**

Replace the `extractSessionMeta` body:

```ts
function extractSessionMeta(filePath: string) {
	return Effect.gen(function* () {
		const meta: MetaFields = {
			timestamp: "",
			slug: "",
			firstMessage: "",
			model: "",
			gitBranch: "",
		};

		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				const obj = parsed as RawLine;
				processMetaLine(obj, meta);
				if (isMetaComplete(meta)) {
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return needed for TypeScript
				return undefined;
			},
			{
				maxLines: 50,
				onMalformed: () => {
					// Malformed lines skipped here; full errors reported by loadClaudeSession()
				},
			},
		).pipe(Effect.catchAll(() => Effect.void));

		if (!(meta.timestamp && meta.firstMessage)) {
			return null;
		}

		return {
			timestamp: meta.timestamp,
			slug: meta.slug || "unknown",
			firstMessage: meta.firstMessage,
			model: meta.model || "unknown",
			gitBranch: meta.gitBranch || "",
		} as Omit<SessionSummary, "sessionId">;
	});
}
```

- [ ] **Step 4: Remove unused constants**

Delete the now-dead constants from the top of the file:

```ts
const BYTES_PER_KB = 1024;
const CWD_SCAN_KB = 64;
const CWD_SCAN_BYTES = CWD_SCAN_KB * BYTES_PER_KB;
const SESSION_META_SCAN_BYTES = BYTES_PER_KB * BYTES_PER_KB;
```

(`BRACKETED_TEXT_REGEX` stays — it's still used by `isInternalMessage`.)

- [ ] **Step 5: Run discovery tests to verify equivalence**

Run: `cd packages/plugin-claude-code && bun test src/discovery.test.ts`
Expected: all tests PASS — output is identical to baseline.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-claude-code/src/discovery.ts
git commit -m "refactor(plugin-claude-code): use streamJsonlHead for metadata extraction"
```

### Task 1.4: Migrate codex's `readTextPrefix` call site

**Files:**
- Modify: `packages/plugin-codex/src/discovery.ts`

- [ ] **Step 1: Run existing codex discovery tests as baseline**

Run: `cd packages/plugin-codex && bun test src/discovery.test.ts`
Expected: PASS.

- [ ] **Step 2: Replace the `readTextPrefix` call with `streamJsonlHead`**

In `packages/plugin-codex/src/discovery.ts`, change the import:

```ts
import { epochSecondsToIso, sortByIsoDesc, streamJsonlHead } from "@cookielab.io/klovi-plugin-core";
```

Drop `readTextPrefix` from the discovery-utils import (keep `readFileText`):

```ts
import { readFileText } from "./shared/discovery-utils.ts";
```

Keep the existing `iterateJsonl` import — it remains used by the renamed string-based fallback `extractFirstUserMessageFromText`:

```ts
import { iterateJsonl } from "./shared/jsonl-utils.ts";
```

Replace `extractFirstUserMessage` to be stream-aware. Add a stream-based variant beside the renamed string-based one:

```ts
function visitForFirstUserMessage(parsed: unknown, captured: { value: string | null }): boolean {
	const event = parsed as CodexEvent;
	if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
		const maxPreviewLength = 200;
		captured.value = event.item.text.slice(0, maxPreviewLength);
		return true;
	}
	if (event.type === "event_msg" && event.payload?.type === "user_message") {
		const payloadText = event.payload.message || event.payload.text;
		if (typeof payloadText === "string" && payloadText) {
			const maxMsgLength = 200;
			captured.value = payloadText.slice(0, maxMsgLength);
			return true;
		}
	}
	return false;
}

function streamFirstUserMessage(filePath: string) {
	return Effect.gen(function* () {
		const captured = { value: null as string | null };
		yield* streamJsonlHead(
			filePath,
			({ parsed, lineIndex }) => {
				if (lineIndex === 0) {
					// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
					return undefined;
				}
				if (visitForFirstUserMessage(parsed, captured)) {
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
				return undefined;
			},
			{ maxLines: 200 },
		).pipe(Effect.catchAll(() => Effect.void));
		return captured.value;
	});
}
```

Then replace the body of `listCodexSessions`'s per-session block (the `for (const s of matching)` loop) so the firstMessage extraction uses `streamFirstUserMessage`:

```ts
for (const s of matching) {
	let firstMessage = s.meta.name ?? "";
	if (!firstMessage) {
		firstMessage = (yield* streamFirstUserMessage(s.filePath)) ?? "";
		if (!firstMessage) {
			const fullText = yield* readFileText(s.filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
			firstMessage = extractFirstUserMessageFromText(fullText) ?? "";
		}
		firstMessage ||= "Codex session";
	}

	const timestamp = epochSecondsToIso(s.meta.timestamps.created);
	sessions.push({
		sessionId: s.meta.uuid,
		timestamp: timestamp,
		slug: s.meta.uuid,
		firstMessage: firstMessage,
		model: s.meta.model || "unknown",
		gitBranch: "",
		pluginId: "codex-cli",
	});
}
```

Rename the existing string-based helper from `extractFirstUserMessage` to `extractFirstUserMessageFromText`. The only remaining caller is the `readFileText` fallback path; the body stays identical (same `iterateJsonl(text, ...)` call, same logic).

- [ ] **Step 3: Drop the dead constants**

Delete:

```ts
const BYTES_PER_KB = 1024;
const SESSION_TITLE_SCAN_KB = 256;
const SESSION_TITLE_SCAN_BYTES = SESSION_TITLE_SCAN_KB * BYTES_PER_KB;
```

- [ ] **Step 4: Run codex tests to verify equivalence**

Run: `cd packages/plugin-codex && bun test src/discovery.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-codex/src/discovery.ts
git commit -m "refactor(plugin-codex): use streamJsonlHead for first-user-message extraction"
```

### Task 1.4b: Migrate `parseSessionMeta` in codex `session-index.ts`

The spec mandates removing `readTextPrefix` (the fake-cap bug). It is also used inside `parseSessionMeta` in `packages/plugin-codex/src/session-index.ts`. Without this task, Task 1.5 will break compile.

**Files:**
- Modify: `packages/plugin-codex/src/session-index.ts`

- [ ] **Step 1: Run codex baseline tests**

Run: `cd packages/plugin-codex && bun test`
Expected: PASS.

- [ ] **Step 2: Replace imports**

In `packages/plugin-codex/src/session-index.ts`, replace:

```ts
import { readTextPrefix } from "./shared/discovery-utils.ts";
import { iterateJsonl } from "./shared/jsonl-utils.ts";
```

with:

```ts
import { streamJsonlHead } from "@cookielab.io/klovi-plugin-core";
```

(`iterateJsonl` is no longer needed in this file once `inferModelFromPrefix` is replaced below.)

- [ ] **Step 3: Replace `inferModelFromPrefix` with a stream-based variant**

Replace the existing string-based helper with a file-streaming version (and rename for clarity):

```ts
function streamInferredModel(filePath: string) {
	return Effect.gen(function* () {
		let model: string | null = null;
		yield* streamJsonlHead(
			filePath,
			({ parsed, lineIndex }) => {
				if (lineIndex === 0) {
					// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
					return undefined;
				}
				const extracted = extractTurnContextModel(parsed);
				if (isKnownModel(extracted)) {
					model = extracted;
					return false;
				}
				// biome-ignore lint/complexity/noUselessUndefined: explicit return for TS narrowing
				return undefined;
			},
			{ maxLines: 256 },
		).pipe(Effect.catchAll(() => Effect.void));
		return model;
	});
}
```

- [ ] **Step 4: Rewrite `parseSessionMeta` to use `streamJsonlHead` for line 1**

```ts
function parseSessionMeta(filePath: string, fileMtimeEpoch: number | undefined) {
	return Effect.gen(function* () {
		let firstLineMeta: CodexSessionMeta | null = null;
		yield* streamJsonlHead(
			filePath,
			({ parsed }) => {
				firstLineMeta = normalizeSessionMeta(parsed, fileMtimeEpoch);
				return false;
			},
			{ maxLines: 1 },
		).pipe(Effect.catchAll(() => Effect.void));

		if (!firstLineMeta) {
			return null;
		}
		if (isKnownModel(firstLineMeta.model)) {
			return firstLineMeta;
		}

		const inferred = yield* streamInferredModel(filePath);
		if (isKnownModel(inferred)) {
			return { ...firstLineMeta, model: inferred };
		}
		if (isKnownModel(firstLineMeta.provider_id)) {
			return { ...firstLineMeta, model: firstLineMeta.provider_id };
		}
		return firstLineMeta;
	});
}
```

(Two reads: line-1 meta, then a 256-line scan only when the model is unknown. Both are bail-early streams; cost is lower than the previous 512 KB full prefix read.)

- [ ] **Step 5: Drop dead constants**

Delete from `session-index.ts`:

```ts
const BYTES_PER_KB = 1024;
const FIRST_LINE_SCAN_KB = 512;
const FIRST_LINE_SCAN_BYTES = FIRST_LINE_SCAN_KB * BYTES_PER_KB;
```

(Keep `MS_PER_SECOND` — still used.)

- [ ] **Step 6: Drop the now-unused `inferModelFromPrefix`**

Delete the original `inferModelFromPrefix` function (replaced by `streamInferredModel`).

- [ ] **Step 7: Run codex tests**

Run: `cd packages/plugin-codex && bun test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/plugin-codex/src/session-index.ts
git commit -m "refactor(plugin-codex): use streamJsonlHead in session-index"
```

### Task 1.5: Remove both `readTextPrefix` copies

**Files:**
- Modify: `packages/plugin-claude-code/src/shared/discovery-utils.ts`
- Modify: `packages/plugin-claude-code/src/shared/discovery-utils.test.ts`
- Modify: `packages/plugin-codex/src/shared/discovery-utils.ts`
- Modify: `packages/plugin-codex/src/shared/discovery-utils.test.ts`

- [ ] **Step 1: Confirm no remaining callers**

Run: `grep -rn 'readTextPrefix' packages apps --include='*.ts' --include='*.tsx'`
Expected: only the function definitions and tests remain — no production callers (`session-index.ts` was migrated in Task 1.4b).

- [ ] **Step 2: Delete `readTextPrefix` from the claude-code copy**

In `packages/plugin-claude-code/src/shared/discovery-utils.ts`, remove the `readTextPrefix` function body and its export.

- [ ] **Step 3: Delete `readTextPrefix` from the codex copy**

In `packages/plugin-codex/src/shared/discovery-utils.ts`, remove the `readTextPrefix` function body and its export.

- [ ] **Step 4: Drop the `readTextPrefix` test in claude-code's discovery-utils**

In `packages/plugin-claude-code/src/shared/discovery-utils.test.ts`:
- Drop `readTextPrefix` from the import line.
- Delete the `test("readTextPrefix reads only requested prefix length", ...)` block.

- [ ] **Step 5: Drop the `readTextPrefix` test in codex's discovery-utils**

In `packages/plugin-codex/src/shared/discovery-utils.test.ts`:
- Drop `readTextPrefix` from the import line:
  ```ts
  import { decodeEncodedPath, readDirEntriesSafe } from "./discovery-utils.ts";
  ```
- Delete the `test("readTextPrefix reads only requested bytes", ...)` block.

- [ ] **Step 6: Run all package checks**

Run: `cd packages/plugin-claude-code && bun run check && cd ../plugin-codex && bun run check`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-claude-code/src/shared/discovery-utils.ts \
	packages/plugin-claude-code/src/shared/discovery-utils.test.ts \
	packages/plugin-codex/src/shared/discovery-utils.ts \
	packages/plugin-codex/src/shared/discovery-utils.test.ts
git commit -m "chore: drop readTextPrefix in favour of streamJsonlHead"
```

---

## §2 — Bounded parallelism in discovery

**Goal:** Replace sequential `for...of yield*` loops with `Effect.forEach` at safe concurrency budgets so independent IO can overlap.

### Task 2.1: Add ordering test for parallel session listing

**Files:**
- Modify: `packages/plugin-claude-code/src/discovery.test.ts`

- [ ] **Step 1: Write a failing ordering test**

Append to `packages/plugin-claude-code/src/discovery.test.ts` (inside the `describe("claude-code discovery", ...)` block):

```ts
test("listClaudeSessions returns sessions in newest-first order regardless of FS order", async () => {
	const projectId = "-Users-dev-many";
	// Create 30 sessions with reverse-sorted timestamps in line 1 to validate sort order.
	for (let i = 0; i < 30; i++) {
		const ts = `2025-01-${(15 - (i % 14)).toString().padStart(2, "0")}T10:${i.toString().padStart(2, "0")}:00.000Z`;
		await writeSession(projectId, `session-${i.toString().padStart(2, "0")}`, [
			JSON.stringify({
				type: "user",
				timestamp: ts,
				slug: `slug-${i}`,
				gitBranch: "main",
				cwd: "/Users/dev/many",
				isMeta: false,
				message: { model: "claude-sonnet-4-5-20250929", content: `msg ${i}` },
			}),
		]);
	}

	const sessions = await run(listClaudeSessions(projectId));
	const timestamps = sessions.map((s) => s.timestamp);
	const sortedDesc = [...timestamps].sort().reverse();
	expect(timestamps).toEqual(sortedDesc);
});
```

- [ ] **Step 2: Run the test — should currently PASS**

Run: `cd packages/plugin-claude-code && bun test src/discovery.test.ts`
Expected: PASS (current sequential code already produces sorted output; test guards against regressions when concurrency is added).

- [ ] **Step 3: Commit**

```bash
git add packages/plugin-claude-code/src/discovery.test.ts
git commit -m "test(plugin-claude-code): assert listClaudeSessions output ordering"
```

### Task 2.2: Parallelize `discoverClaudeProjects` and `listClaudeSessions`

**Files:**
- Modify: `packages/plugin-claude-code/src/discovery.ts`

- [ ] **Step 1: Add concurrency constants**

Add at the top of `packages/plugin-claude-code/src/discovery.ts` (below the existing `BRACKETED_TEXT_REGEX`):

```ts
const PROJECT_DIR_CONCURRENCY = 16;
const SESSION_FILE_CONCURRENCY = 16;
```

- [ ] **Step 2: Replace `discoverClaudeProjects`'s loop with `Effect.forEach`**

```ts
function discoverClaudeProjects() {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const projectsDir = join(config.dataDir, "projects");
		const entries = yield* readDirEntriesSafe(projectsDir);
		const directories = entries.filter((entry) => entry.isDirectory);

		const projects = yield* Effect.forEach(
			directories,
			(entry) =>
				Effect.gen(function* () {
					const projectDir = join(projectsDir, entry.name);
					const sessionFiles = yield* listFilesWithMtime(projectDir, ".jsonl");
					if (sessionFiles.length === 0) {
						return null;
					}

					const projectInfo = yield* inspectProjectSessions(projectDir, sessionFiles);
					const resolvedPath = projectInfo.resolvedPath || decodeEncodedPath(entry.name);

					return {
						pluginId: "claude-code",
						nativeId: entry.name,
						resolvedPath: resolvedPath,
						displayName: resolvedPath,
						sessionCount: sessionFiles.length,
						lastActivity: projectInfo.lastActivity,
					} as PluginProject;
				}),
			{ concurrency: PROJECT_DIR_CONCURRENCY },
		);

		const filtered = projects.filter((p): p is PluginProject => p !== null);
		sortByIsoDesc(filtered, (project) => project.lastActivity);
		return filtered;
	});
}
```

- [ ] **Step 3: Replace `listClaudeSessions`'s loop with `Effect.forEach`**

```ts
function listClaudeSessions(nativeId: string) {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const projectDir = join(config.dataDir, "projects", nativeId);
		const files = yield* listFilesBySuffix(projectDir, ".jsonl");

		const candidates = yield* Effect.forEach(
			files,
			(file) =>
				Effect.gen(function* () {
					const filePath = join(projectDir, file);
					const sessionId = file.replace(".jsonl", "");
					const meta = yield* extractSessionMeta(filePath);
					return meta ? ({ sessionId: sessionId, pluginId: "claude-code", ...meta } as SessionSummary) : null;
				}),
			{ concurrency: SESSION_FILE_CONCURRENCY },
		);

		const sessions = candidates.filter((s): s is SessionSummary => s !== null);
		classifySessionTypes(sessions);
		sortByIsoDesc(sessions, (session) => session.timestamp);
		return sessions;
	});
}
```

- [ ] **Step 4: Refactor `inspectProjectSessions` to read newest-first only**

```ts
function inspectProjectSessions(projectDir: string, sessionFiles: { fileName: string; mtime: string }[]) {
	return Effect.gen(function* () {
		const lastActivity = sessionFiles[0]?.mtime || "";
		let resolvedPath = "";

		// sessionFiles is sorted newest-first; try newest first, fall back only on empty result
		for (const sessionFile of sessionFiles) {
			const filePath = join(projectDir, sessionFile.fileName);
			resolvedPath = yield* extractCwd(filePath);
			if (resolvedPath) {
				break;
			}
		}

		return { lastActivity: lastActivity, resolvedPath: resolvedPath };
	});
}
```

(This already breaks early on first hit; the change clarifies intent and removes the dead-write of an empty `resolvedPath`.)

- [ ] **Step 5: Run discovery tests**

Run: `cd packages/plugin-claude-code && bun test src/discovery.test.ts`
Expected: all tests PASS, including the ordering test from Task 2.1.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-claude-code/src/discovery.ts
git commit -m "perf(plugin-claude-code): parallelize project and session discovery"
```

### Task 2.3: Parallelize `readDirEntriesSafe` and `listFilesWithMtime`

**Files:**
- Modify: `packages/plugin-claude-code/src/shared/discovery-utils.ts`
- Modify: `packages/plugin-codex/src/shared/discovery-utils.ts`

- [ ] **Step 1: Replace `readDirEntriesSafe` in claude-code**

In `packages/plugin-claude-code/src/shared/discovery-utils.ts`:

```ts
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
```

- [ ] **Step 2: Replace `listFilesWithMtime` in claude-code**

```ts
export function listFilesWithMtime(dir: string, suffix: string) {
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
```

- [ ] **Step 3: Replace `getLatestMtime` in claude-code (kept for symmetry)**

```ts
export function getLatestMtime(dir: string, files: readonly string[]) {
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
```

- [ ] **Step 4: Mirror the parallelization in codex's `readDirEntriesSafe`**

In `packages/plugin-codex/src/shared/discovery-utils.ts`:

```ts
import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

const STAT_CONCURRENCY = 32;
const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Za-z]\//u;

type DirEntry = {
	name: string;
	isDirectory: boolean;
};

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
```

(Keep the rest of the codex file unchanged — `readFileText`, `fileExists`, `decodeEncodedPath`.)

- [ ] **Step 5: Run discovery-utils tests**

Run: `cd packages/plugin-claude-code && bun test src/shared/discovery-utils.test.ts && cd ../plugin-codex && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-claude-code/src/shared/discovery-utils.ts \
	packages/plugin-codex/src/shared/discovery-utils.ts
git commit -m "perf(discovery-utils): parallelize fs.stat with bounded concurrency"
```

### Task 2.4: Parallelize codex discovery loops

**Files:**
- Modify: `packages/plugin-codex/src/discovery.ts`

- [ ] **Step 1: Add concurrency constant**

```ts
const SESSION_FILE_CONCURRENCY = 16;
```

- [ ] **Step 2: Replace `listCodexSessions`'s per-session loop with `Effect.forEach`**

```ts
function listCodexSessions(nativeId: string) {
	return Effect.gen(function* () {
		const allSessions = yield* scanCodexSessions();
		const matching = allSessions.filter((s) => s.meta.cwd === nativeId);

		const sessions = yield* Effect.forEach(
			matching,
			(s) =>
				Effect.gen(function* () {
					let firstMessage = s.meta.name ?? "";
					if (!firstMessage) {
						firstMessage = (yield* streamFirstUserMessage(s.filePath)) ?? "";
						if (!firstMessage) {
							const fullText = yield* readFileText(s.filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
							firstMessage = extractFirstUserMessageFromText(fullText) ?? "";
						}
						firstMessage ||= "Codex session";
					}
					const timestamp = epochSecondsToIso(s.meta.timestamps.created);
					return {
						sessionId: s.meta.uuid,
						timestamp: timestamp,
						slug: s.meta.uuid,
						firstMessage: firstMessage,
						model: s.meta.model || "unknown",
						gitBranch: "",
						pluginId: "codex-cli",
					} as SessionSummary;
				}),
			{ concurrency: SESSION_FILE_CONCURRENCY },
		);

		sortByIsoDesc(sessions, (session) => session.timestamp);
		return sessions;
	});
}
```

(`discoverCodexProjects`'s `byCwd` build is already O(n) over an in-memory array — no parallelism needed there; the IO is in `scanCodexSessions`.)

- [ ] **Step 3: Run codex tests**

Run: `cd packages/plugin-codex && bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-codex/src/discovery.ts
git commit -m "perf(plugin-codex): parallelize per-session discovery loop"
```

### Task 2.5: Parallelize `discoverPluginStates` in plugin-core

**Files:**
- Modify: `packages/plugin-core/src/plugin-registry.ts`

- [ ] **Step 1: Replace the sequential loop with `Effect.forEach({ concurrency: "unbounded" })`**

In `discoverPluginStates`:

```ts
private discoverPluginStates(
	includeSessions: boolean,
): Effect.Effect<DiscoveredPluginState<TPluginId, TSessionSummary, TSession>[], never, RegistryRequirements> {
	return Effect.gen(this, function* () {
		const entries = [...this.plugins.values()];
		return yield* Effect.forEach(
			entries,
			(entry) =>
				Effect.gen(function* () {
					const discoveredIndex =
						includeSessions && entry.plugin.discoverIndex
							? yield* entry.plugin.discoverIndex.pipe(
									Effect.provide(entry.configLayer),
									Effect.catchAll(() => Effect.succeed(undefined)),
								)
							: undefined;

					const projects =
						discoveredIndex?.projects ??
						(yield* entry.plugin.discoverProjects.pipe(
							Effect.provide(entry.configLayer),
							Effect.catchAll(() => Effect.succeed([] as PluginProject<TPluginId>[])),
						));

					return {
						entry: entry,
						projects: projects,
						...(discoveredIndex ? { sessionsByNativeId: discoveredIndex.sessionsByNativeId } : {}),
					} as DiscoveredPluginState<TPluginId, TSessionSummary, TSession>;
				}),
			{ concurrency: "unbounded" },
		);
	});
}
```

- [ ] **Step 2: Run all package tests**

Run: `cd packages/plugin-core && bun run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/plugin-core/src/plugin-registry.ts
git commit -m "perf(plugin-core): parallelize plugin discovery"
```

### Task 2.6: Run full repo verification after §2

- [ ] **Step 1: Run lint, typecheck, and tests across the workspace**

Run: `bun run lint && bun run typecheck && bun test`
Expected: all PASS. Fix any tests destabilized by ordering changes.

- [ ] **Step 2: No commit needed if everything passes; otherwise commit fixes**

```bash
# only if there are fixes
git add -p
git commit -m "fix: stabilize tests after concurrency changes"
```

---

## §3a — Server-side streaming session parse

**Goal:** Replace `readJsonlLines`'s full-file string allocation with a streaming parse that yields chunks through the event loop.

### Task 3a.1: Add `streamJsonl` primitive (no line cap)

**Files:**
- Modify: `packages/plugin-core/src/jsonl-stream.ts`
- Modify: `packages/plugin-core/src/jsonl-stream.test.ts`

- [ ] **Step 1: Write the failing test for `streamJsonl`**

Append to `packages/plugin-core/src/jsonl-stream.test.ts`:

```ts
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
```

Update the import line at the top of the test:

```ts
import { streamJsonl, streamJsonlHead } from "./jsonl-stream.ts";
```

- [ ] **Step 2: Run the test — should FAIL**

Run: `cd packages/plugin-core && bun test src/jsonl-stream.test.ts`
Expected: FAIL — `streamJsonl` is not exported.

- [ ] **Step 3: Implement `streamJsonl`**

Add to `packages/plugin-core/src/jsonl-stream.ts`:

```ts
const DEFAULT_FULL_CHUNK_SIZE = 64 * 1024;

type StreamJsonlOptions = {
	chunkSize?: number;
	onMalformed?: (line: string, lineNumber: number, error: unknown) => void;
};

function streamJsonl(
	filePath: string,
	visitor: JsonlVisitor,
	options: StreamJsonlOptions = {},
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const indexRef = yield* Ref.make(0);
		const chunkSize = options.chunkSize ?? DEFAULT_FULL_CHUNK_SIZE;

		yield* fs
			.stream(filePath, { chunkSize: chunkSize })
			.pipe(Stream.decodeText("utf-8"), Stream.splitLines)
			.pipe(
				Stream.runForEach((line) =>
					Effect.gen(function* () {
						const lineIndex = yield* Ref.getAndUpdate(indexRef, (n) => n + 1);
						const trimmed = line.trim();
						if (!trimmed) {
							return;
						}
						const lineNumber = lineIndex + 1;
						try {
							const parsed = JSON.parse(line);
							visitor({ parsed: parsed, line: line, lineIndex: lineIndex, lineNumber: lineNumber });
						} catch (error) {
							options.onMalformed?.(line, lineNumber, error);
						}
					}),
				),
			);
	});
}

export type { StreamJsonlOptions };
export { streamJsonl };
```

(Keep the existing `streamJsonlHead` export.)

- [ ] **Step 4: Run tests**

Run: `cd packages/plugin-core && bun test src/jsonl-stream.test.ts`
Expected: PASS.

- [ ] **Step 5: Export from package entry**

In `packages/plugin-core/src/index.ts` extend the existing line:

```ts
export type { JsonlLineContext, JsonlVisitor, StreamJsonlHeadOptions, StreamJsonlOptions } from "./jsonl-stream.ts";
export { streamJsonl, streamJsonlHead } from "./jsonl-stream.ts";
```

Run: `cd packages/plugin-core && bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-core/src/jsonl-stream.ts \
	packages/plugin-core/src/jsonl-stream.test.ts \
	packages/plugin-core/src/index.ts
git commit -m "feat(plugin-core): add streamJsonl primitive for full-file streaming reads"
```

### Task 3a.2: Migrate `readJsonlLines` in plugin-claude-code

**Files:**
- Modify: `packages/plugin-claude-code/src/parser.ts`
- Test: `packages/plugin-claude-code/src/parser.test.ts` (existing tests must stay green)

- [ ] **Step 1: Run existing parser tests as a baseline**

Run: `cd packages/plugin-claude-code && bun test src/parser.test.ts`
Expected: PASS.

- [ ] **Step 2: Replace `readJsonlLines` with stream-based version**

In `packages/plugin-claude-code/src/parser.ts`, change the imports:

```ts
import { PluginConfig, streamJsonl } from "@cookielab.io/klovi-plugin-core";
```

Drop `readFileText` and `iterateJsonl` imports:

```ts
// Remove:
// import { readFileText } from "./shared/discovery-utils.ts";
// import { iterateJsonl } from "./shared/jsonl-utils.ts";
```

Replace `readJsonlLines`:

```ts
function readJsonlLines(filePath: string) {
	return Effect.gen(function* () {
		const rawLines: RawLine[] = [];
		const parseErrors: ParseErrorTurn[] = [];

		yield* streamJsonl(filePath, ({ parsed }) => {
			rawLines.push(parsed as RawLine);
		}, {
			onMalformed: (line, lineNumber, error) => {
				parseErrors.push({
					kind: "parse_error",
					uuid: `parse-error-line-${lineNumber}`,
					timestamp: rawLines.at(-1)?.timestamp ?? "",
					lineNumber: lineNumber,
					rawLine:
						line.length > MAX_RAW_LINE_LENGTH ? `${line.slice(0, MAX_RAW_LINE_LENGTH)}… (truncated)` : line,
					errorType: "json_parse",
					errorDetails: error instanceof Error ? error.message : undefined,
				});
			},
		});

		return { rawLines: rawLines, parseErrors: parseErrors } as ParsedLines;
	});
}
```

- [ ] **Step 3: Run parser tests**

Run: `cd packages/plugin-claude-code && bun test src/parser.test.ts`
Expected: PASS — output is identical because `buildTurns` still consumes the array.

- [ ] **Step 4: Add a streaming-memory test**

Append to `packages/plugin-claude-code/src/parser.test.ts`:

```ts
import { afterEach, beforeEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { loadClaudeSession } from "./parser.ts";

const memTestDir = join(tmpdir(), `klovi-claude-parser-mem-${Date.now()}`);
const memTestLayer = Layer.mergeAll(NodeFileSystem.layer, Layer.succeed(PluginConfig, { dataDir: memTestDir }));
function memRun<A, E, R>(eff: Effect.Effect<A, E, R>) {
	return Effect.runPromise(eff.pipe(Effect.provide(memTestLayer)) as Effect.Effect<A, E, never>);
}

describe("loadClaudeSession streaming memory", () => {
	beforeEach(async () => {
		await rm(memTestDir, { recursive: true, force: true });
		await mkdir(join(memTestDir, "projects", "p"), { recursive: true });
	});
	afterEach(async () => {
		await rm(memTestDir, { recursive: true, force: true });
	});

	test("does not allocate full file size as a single string", async () => {
		const sessionId = "huge-session";
		const filePath = join(memTestDir, "projects", "p", `${sessionId}.jsonl`);
		const padLine = JSON.stringify({
			type: "user",
			timestamp: "2025-01-15T10:00:00Z",
			isMeta: false,
			message: { role: "user", content: "x".repeat(1024) },
		});
		const lineCount = 50_000; // ~50 MB total
		const lines = Array.from({ length: lineCount }, () => padLine);
		await Bun.write(filePath, lines.join("\n"));

		if (typeof global.gc === "function") {
			global.gc();
		}
		const before = process.memoryUsage().heapUsed;
		const result = await memRun(loadClaudeSession("p", sessionId));
		const after = process.memoryUsage().heapUsed;
		expect(result.session.turns.length).toBeGreaterThan(0);

		// File is ~50 MB; before streaming we'd hold a full 50 MB string in addition to the array.
		// Streaming should keep peak heap delta well under 30 MB.
		const heapDelta = after - before;
		expect(heapDelta).toBeLessThan(30 * 1024 * 1024);
	});
});
```

- [ ] **Step 5: Run the new test**

Run: `cd packages/plugin-claude-code && bun test src/parser.test.ts`
Expected: PASS. (If it fails by margin, adjust the threshold to a value still well under "full-file string" worst case.)

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-claude-code/src/parser.ts packages/plugin-claude-code/src/parser.test.ts
git commit -m "perf(plugin-claude-code): stream JSONL during session load"
```

---

## §4a — Virtualize MessageList

**Goal:** Mount only the visible turns of the MessageList so that 5,000-turn sessions render without mounting 5,000 React subtrees.

### Task 4a.1: Add `@tanstack/react-virtual` dependency

**Files:**
- Modify: `packages/ui-components/package.json`
- Modify: `test-setup.ts`

- [ ] **Step 1: Add the package**

Run from the workspace root: `bun add @tanstack/react-virtual --filter '@cookielab.io/klovi-ui-components'`

If `--filter` is not supported in this workspace setup, instead manually add to `packages/ui-components/package.json` under `"dependencies"`:

```json
"@tanstack/react-virtual": "3.13.6"
```

Then run: `bun install`

- [ ] **Step 2: Add a no-op `ResizeObserver` shim to `test-setup.ts`**

Append to `test-setup.ts` after the globals registration:

```ts
// Shim ResizeObserver for @tanstack/react-virtual measureElement under happy-dom
if (!("ResizeObserver" in globalThis)) {
	class ResizeObserverShim {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
	(globalThis as Record<string, unknown>)["ResizeObserver"] = ResizeObserverShim;
}
```

- [ ] **Step 3: Verify install + lint**

Run: `cd packages/ui-components && bun run lint && bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-components/package.json bun.lock test-setup.ts
git commit -m "chore: add @tanstack/react-virtual and ResizeObserver shim"
```

### Task 4a.2: Virtualize `MessageList`

**Files:**
- Modify: `packages/ui-components/src/messages/MessageList.tsx`
- Test: existing component tests must stay green; add a new render test for the virtualized scroll container.

- [ ] **Step 1: Replace `MessageList`'s render with `useVirtualizer`**

Open `packages/ui-components/src/messages/MessageList.tsx`. Add imports:

```tsx
import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
```

Replace the `MessageList` body:

```tsx
const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const SCROLL_INNER_CLASSES = "relative w-full mx-auto max-w-[900px] p-5";

export function MessageList({
	turns,
	visibleSubSteps,
	sessionId,
	project,
	pluginId,
	isSubAgent,
	planSessionId,
	implSessionId,
	onSessionLink,
	onLinkClick,
	getFrontendPlugin,
}: MessageListProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const firstUserTurnIndex = useMemo(
		() =>
			turns.findIndex((t) => {
				if (t.kind !== "user") {
					return false;
				}
				return !STATUS_RE.test(t.text.trim());
			}),
		[turns],
	);

	const virtualizer = useVirtualizer({
		count: turns.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 200,
		overscan: 5,
		measureElement: (el) => el.getBoundingClientRect().height,
	});

	const totalSize = virtualizer.getTotalSize();
	const items = virtualizer.getVirtualItems();

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<style>{STEP_FADE_IN_KEYFRAMES}</style>
			<div className={SCROLL_INNER_CLASSES} style={{ height: totalSize }}>
				{items.map((item) => {
					const turn = turns[item.index];
					if (!turn) {
						return null;
					}
					const isActive = visibleSubSteps ? item.index === turns.length - 1 : false;
					return (
						<div
							key={turn.uuid || item.index}
							ref={virtualizer.measureElement}
							data-index={item.index}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${item.start}px)`,
							}}
						>
							<ErrorBoundary inline={true}>
								{renderTurn({
									turn: turn,
									index: item.index,
									isActive: isActive,
									visibleSubSteps: visibleSubSteps,
									sessionId: sessionId,
									project: project,
									pluginId: pluginId,
									isSubAgent: isSubAgent,
									planSessionId: planSessionId,
									implSessionId: item.index === firstUserTurnIndex ? implSessionId : undefined,
									onSessionLink: onSessionLink,
									onLinkClick: onLinkClick,
									getFrontendPlugin: getFrontendPlugin,
								})}
							</ErrorBoundary>
						</div>
					);
				})}
			</div>
		</div>
	);
}
```

(Drop the now-unused `MESSAGE_LIST_CLASSES` constant.)

- [ ] **Step 2: Add a render test that exercises the virtualized container**

Create `packages/ui-components/src/messages/MessageList.test.tsx`:

```tsx
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Turn } from "../types/index.ts";
import { MessageList } from "./MessageList.tsx";

afterEach(cleanup);

function makeTurn(i: number): Turn {
	return {
		kind: "user",
		uuid: `t-${i}`,
		timestamp: "2025-01-15T10:00:00Z",
		text: `message ${i}`,
	} as Turn;
}

describe("MessageList virtualization", () => {
	test("renders only a windowed slice when many turns are passed", () => {
		const turns = Array.from({ length: 500 }, (_, i) => makeTurn(i));
		const { container } = render(
			<div style={{ height: 600, width: 800 }}>
				<MessageList turns={turns} />
			</div>,
		);
		const items = container.querySelectorAll("[data-index]");
		// Window + overscan should be far less than 500.
		expect(items.length).toBeLessThan(50);
		expect(items.length).toBeGreaterThan(0);
	});

	test("uses turn.uuid as a stable key when present", () => {
		const turns: Turn[] = [makeTurn(0), makeTurn(1), makeTurn(2)];
		const { container } = render(
			<div style={{ height: 600, width: 800 }}>
				<MessageList turns={turns} />
			</div>,
		);
		const indexes = Array.from(container.querySelectorAll("[data-index]")).map((el) => el.getAttribute("data-index"));
		expect(indexes.includes("0")).toBe(true);
	});
});
```

Note: happy-dom's `getBoundingClientRect` returns zeros, so `useVirtualizer` will fall back to `estimateSize`. The fixed-height parent (`<div style={{ height: 600 }}>`) is what makes the windowing path execute.

- [ ] **Step 3: Run the test**

Run: `cd packages/ui-components && bun test src/messages/MessageList.test.tsx`
Expected: PASS. If it fails because `useVirtualizer` won't render any items under happy-dom, set the parent's `getBoundingClientRect` via `Object.defineProperty(parentRef.current, "getBoundingClientRect", ...)` before assertion (only as a last resort — first try the test as-is).

- [ ] **Step 4: Run all ui-components tests to confirm no regressions**

Run: `cd packages/ui-components && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-components/src/messages/MessageList.tsx packages/ui-components/src/messages/MessageList.test.tsx
git commit -m "perf(ui-components): virtualize MessageList rendering"
```

### Task 4a.3: Anchor scroll on tail-append (forward-compatible with §3b)

**Files:**
- Modify: `packages/ui-components/src/messages/MessageList.tsx`
- Modify: `packages/ui-components/src/messages/MessageList.test.tsx`

- [ ] **Step 1: Add scroll-anchor effect**

Update the React import at the top of `packages/ui-components/src/messages/MessageList.tsx` to also import `useEffect`:

```tsx
import { useEffect, useMemo, useRef } from "react";
```

Inside the `MessageList` body, just before `return`, add:

```tsx
const previousCountRef = useRef(turns.length);
useEffect(() => {
	const previous = previousCountRef.current;
	if (turns.length > previous && parentRef.current) {
		// Append happened (e.g., §3b tail). Preserve current scrollTop so the user
		// is not jumped by the layout-size change.
		const offset = parentRef.current.scrollTop;
		// Wait for layout to flush, then restore.
		requestAnimationFrame(() => {
			if (parentRef.current) {
				parentRef.current.scrollTop = offset;
			}
		});
	}
	previousCountRef.current = turns.length;
}, [turns.length]);
```

- [ ] **Step 2: Add `scrollToIndex` for active-message changes**

Below the previous effect:

```tsx
useEffect(() => {
	if (!visibleSubSteps) {
		return;
	}
	const lastIndex = turns.length - 1;
	if (lastIndex < 0) {
		return;
	}
	virtualizer.scrollToIndex(lastIndex, { align: "center" });
}, [visibleSubSteps, turns.length, virtualizer]);
```

- [ ] **Step 3: Add a test that asserts scroll preservation when turns are appended**

Append to `packages/ui-components/src/messages/MessageList.test.tsx`:

```tsx
test("appending turns does not reset scrollTop", async () => {
	const initial = Array.from({ length: 100 }, (_, i) => makeTurn(i));
	const { container, rerender } = render(
		<div style={{ height: 600, width: 800 }}>
			<MessageList turns={initial} />
		</div>,
	);
	const scrollEl = container.querySelector(".overflow-auto") as HTMLElement | null;
	expect(scrollEl).not.toBeNull();
	if (scrollEl) {
		scrollEl.scrollTop = 500;
	}

	const appended = [...initial, ...Array.from({ length: 50 }, (_, i) => makeTurn(100 + i))];
	rerender(
		<div style={{ height: 600, width: 800 }}>
			<MessageList turns={appended} />
		</div>,
	);

	await new Promise((resolve) => requestAnimationFrame(resolve));
	expect((scrollEl as HTMLElement).scrollTop).toBe(500);
});
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ui-components && bun test src/messages/MessageList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-components/src/messages/MessageList.tsx packages/ui-components/src/messages/MessageList.test.tsx
git commit -m "feat(ui-components): preserve scroll on MessageList append"
```

---

## §3b — Two-phase session-load RPC

**Goal:** Ship the head turns in a small, fast RPC so the client paints immediately, then append the rest when the tail arrives.

### Task 3b.1: Refactor `sessions-service` to expose head/tail loaders

**Files:**
- Modify: `packages/server/src/services/sessions-service.ts`
- Create: `packages/server/src/services/sessions-service.test.ts`

- [ ] **Step 1: Write failing tests for the new functions**

Create `packages/server/src/services/sessions-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig, SqliteClientTag } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createClaudeCodePlugin } from "@cookielab.io/klovi-plugin-claude-code";
import { PluginRegistry } from "../registry.ts";
import { getSession, getSessionHead, getSessionTail } from "./sessions-service.ts";

const testDir = join(tmpdir(), `klovi-sessions-service-test-${Date.now()}`);
const testLayer = Layer.mergeAll(
	NodeFileSystem.layer,
	Layer.succeed(PluginConfig, { dataDir: testDir }),
	Layer.succeed(SqliteClientTag, { open: () => Effect.succeed(null) }),
);

function run<A, E, R>(eff: Effect.Effect<A, E, R>) {
	return Effect.runPromise(eff.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);
}

async function writeSession(projectId: string, sessionId: string, turnCount: number): Promise<void> {
	const projectDir = join(testDir, "projects", projectId);
	await mkdir(projectDir, { recursive: true });
	const lines: string[] = [];
	for (let i = 0; i < turnCount; i++) {
		lines.push(
			JSON.stringify({
				type: "user",
				uuid: `u-${i}`,
				timestamp: `2025-01-15T10:${i.toString().padStart(2, "0")}:00Z`,
				message: { role: "user", content: `msg ${i}` },
			}),
		);
	}
	await Bun.write(join(projectDir, `${sessionId}.jsonl`), lines.join("\n"));
}

beforeEach(async () => {
	await rm(testDir, { recursive: true, force: true });
	await mkdir(testDir, { recursive: true });
});
afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("getSessionHead / getSessionTail", () => {
	test("head returns first headSize turns and totalTurns", async () => {
		await writeSession("-Users-x", "s1", 30);
		const registry = new PluginRegistry();
		registry.register(createClaudeCodePlugin(), { dataDir: testDir });

		const result = await run(
			getSessionHead(registry, {
				sessionId: "claude-code:s1",
				project: "/Users/x",
				headSize: 10,
			}),
		);
		expect(result.totalTurns).toBe(30);
		expect(result.session.turns.length).toBe(10);
	});

	test("tail returns turns after fromTurn", async () => {
		await writeSession("-Users-x", "s1", 30);
		const registry = new PluginRegistry();
		registry.register(createClaudeCodePlugin(), { dataDir: testDir });

		const result = await run(
			getSessionTail(registry, {
				sessionId: "claude-code:s1",
				project: "/Users/x",
				fromTurn: 10,
			}),
		);
		expect(result.turns.length).toBe(20);
	});

	test("tail returns empty array when fromTurn >= totalTurns", async () => {
		await writeSession("-Users-x", "s1", 5);
		const registry = new PluginRegistry();
		registry.register(createClaudeCodePlugin(), { dataDir: testDir });

		const result = await run(
			getSessionTail(registry, {
				sessionId: "claude-code:s1",
				project: "/Users/x",
				fromTurn: 100,
			}),
		);
		expect(result.turns).toEqual([]);
	});
});
```

(Adapt the import path of `createClaudeCodePlugin` and `PluginRegistry` to match the actual module the server uses to wire plugins. Check `packages/server/src/services/auto-discover.ts` for the precise import paths if the snippet above does not resolve.)

- [ ] **Step 2: Run the tests — should FAIL**

Run: `cd packages/server && bun test src/services/sessions-service.test.ts`
Expected: FAIL — `getSessionHead` and `getSessionTail` do not exist.

- [ ] **Step 3: Refactor `getSession` to expose head/tail loaders**

In `packages/server/src/services/sessions-service.ts`, add a shared internal loader and the new exports:

```ts
const DEFAULT_HEAD_SIZE = 100;

type SessionHeadResponse = {
	session: Session;
	totalTurns: number;
};

type SessionTailResponse = {
	turns: Turn[];
};

function loadSessionInternal(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<{ session: Session; pluginId: string; rawSessionId: string }, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const projects = yield* registry.discoverAllProjects();
		const project = projects.find((p) => p.encodedPath === params.project);
		if (!project) {
			return yield* Effect.fail(new ProjectNotFoundError({ encodedPath: params.project }));
		}

		const source = project.sources.find((s) => s.pluginId === parsed.pluginId);
		if (!source) {
			return yield* Effect.fail(new PluginSourceNotFoundError({ pluginId: parsed.pluginId, project: params.project }));
		}

		const plugin = registry.getPlugin(parsed.pluginId);
		const pluginConfig = registry.getPluginConfig(parsed.pluginId);
		const configLayer = makePluginConfigLayer(pluginConfig);

		const sessionDetail = plugin.loadSessionDetail
			? yield* plugin.loadSessionDetail(source.nativeId, parsed.rawSessionId).pipe(
					Effect.provide(configLayer),
					Effect.catchAll(() => Effect.succeed(undefined)),
				)
			: undefined;

		const session =
			sessionDetail?.session ??
			(yield* plugin.loadSession(source.nativeId, parsed.rawSessionId).pipe(
				Effect.provide(configLayer),
				Effect.catchAll(() => Effect.die("loadSession failed")),
			));

		session.sessionId = encodeSessionId(parsed.pluginId, parsed.rawSessionId);
		session.pluginId = parsed.pluginId;
		session.planSessionId = sessionDetail?.planSessionId
			? encodeSessionId(parsed.pluginId, sessionDetail.planSessionId)
			: undefined;
		session.implSessionId = sessionDetail?.implSessionId
			? encodeSessionId(parsed.pluginId, sessionDetail.implSessionId)
			: undefined;
		return { session: session, pluginId: parsed.pluginId, rawSessionId: parsed.rawSessionId };
	});
}

function getSession(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<SessionResponse, GetSessionError, RegistryRequirements> {
	return loadSessionInternal(registry, params).pipe(Effect.map(({ session }) => ({ session: session })));
}

function getSessionHead(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; headSize?: number },
): Effect.Effect<SessionHeadResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const { session } = yield* loadSessionInternal(registry, params);
		const headSize = params.headSize ?? DEFAULT_HEAD_SIZE;
		const totalTurns = session.turns.length;
		const headSession: Session = { ...session, turns: session.turns.slice(0, headSize) };
		return { session: headSession, totalTurns: totalTurns };
	});
}

function getSessionTail(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; fromTurn: number },
): Effect.Effect<SessionTailResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const { session } = yield* loadSessionInternal(registry, params);
		const fromTurn = Math.max(0, params.fromTurn);
		return { turns: fromTurn >= session.turns.length ? [] : session.turns.slice(fromTurn) };
	});
}

export type { SessionHeadResponse, SessionTailResponse };
export { getProjects, getSession, getSessionHead, getSessions, getSessionTail, getSubAgent, searchSessions };
```

Add the import for `Turn` at the top:

```ts
import type {
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
```

- [ ] **Step 4: Run the new tests**

Run: `cd packages/server && bun test src/services/sessions-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/sessions-service.ts \
	packages/server/src/services/sessions-service.test.ts
git commit -m "feat(server): split getSession into head + tail loaders"
```

### Task 3b.2: Wire the new methods into `KloviServicesShape`

**Files:**
- Modify: `packages/server/src/effect/server-services.ts`

- [ ] **Step 1: Extend the shape type**

In `packages/server/src/effect/server-services.ts`, add to `KloviServicesShape`:

```ts
readonly getSessionHead: (params: {
	sessionId: string;
	project: string;
	headSize?: number;
}) => Effect.Effect<
	{ session: Session; totalTurns: number },
	InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError,
	RegistryRequirements
>;
readonly getSessionTail: (params: {
	sessionId: string;
	project: string;
	fromTurn: number;
}) => Effect.Effect<
	{ turns: Turn[] },
	InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError,
	RegistryRequirements
>;
```

Add the `Turn` import:

```ts
import type {
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
```

Update the imports of session services:

```ts
import { getProjects, getSession, getSessionHead, getSessions, getSessionTail, getSubAgent, searchSessions } from "../services/sessions-service.ts";
```

Wire the implementations inside `KloviServicesLive`:

```ts
getSessionHead: (params) => getSessionHead(registry, params),
getSessionTail: (params) => getSessionTail(registry, params),
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/server && bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/effect/server-services.ts
git commit -m "feat(server): expose getSessionHead and getSessionTail in service shape"
```

### Task 3b.3: Add desktop RPC handlers and contract entries

**Files:**
- Modify: `packages/ui/src/shared/desktop-contract.ts`
- Modify: `packages/ui/src/shared/types.ts`
- Modify: `apps/desktop/src/bun/rpc-handlers.ts`

- [ ] **Step 1: Extend `DesktopClientRequestMap` in `desktop-contract.ts`**

```ts
getSessionHead: DesktopRequestDefinition<
	{ sessionId: string; project: string; headSize?: number },
	{ session: Session; totalTurns: number }
>;
getSessionTail: DesktopRequestDefinition<
	{ sessionId: string; project: string; fromTurn: number },
	{ turns: Turn[] }
>;
```

Update the `Turn` import in the same file (top):

```ts
import type { DashboardStats, GlobalSessionResult, Project, Session, SessionSummary, StatsResponse, Turn } from "./types.ts";
```

- [ ] **Step 2: Re-export `Turn` from `packages/ui/src/shared/types.ts`** (if not already)

Verify `Turn` is part of `packages/ui/src/shared/types.ts` exports. If not, add:

```ts
export type { Turn } from "@cookielab.io/klovi-plugin-core";
```

- [ ] **Step 3: Add handlers in `apps/desktop/src/bun/rpc-handlers.ts`**

Add the imports:

```ts
import {
	getSession as getSessionEffect,
	getSessionHead as getSessionHeadEffect,
	getSessionTail as getSessionTailEffect,
	getSessions as getSessionsEffect,
	getSubAgent as getSubAgentEffect,
	searchSessions as searchSessionsEffect,
} from "@cookielab.io/klovi-server/services/sessions-service";
```

Add the handler functions:

```ts
const getSessionHeadHandler = (params: { sessionId: string; project: string; headSize?: number }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionHeadEffect(registry, params);
	});

const getSessionTailHandler = (params: { sessionId: string; project: string; fromTurn: number }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionTailEffect(registry, params);
	});
```

Extend the export list to include the new handlers:

```ts
export {
	acceptRisksHandler,
	applyUpdateHandler,
	checkForUpdateHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionHeadHandler,
	getSessionsHandler,
	getSessionTailHandler,
	getStatsHandler,
	getSubAgentHandler,
	getUpdateSettingsHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	refreshStatsHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
	updateUpdateSettingsHandler,
};
```

Then in `apps/desktop/src/bun/index.ts`, extend the import block (around line 13–33) to include the two new handler names:

```ts
import {
	acceptRisksHandler,
	applyUpdateHandler,
	checkForUpdateHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionHeadHandler,
	getSessionsHandler,
	getSessionTailHandler,
	getStatsHandler,
	getSubAgentHandler,
	getUpdateSettingsHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	refreshStatsHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
	updateUpdateSettingsHandler,
} from "./rpc-handlers.ts";
```

Inside the RPC `bun.handlers` block (right after the existing `getSession:` line — current line 136), register the two new methods:

```ts
getSession: (params) => bridgeHandler(runtime, getSessionHandler(params)),
getSessionHead: (params) => bridgeHandler(runtime, getSessionHeadHandler(params)),
getSessionTail: (params) => bridgeHandler(runtime, getSessionTailHandler(params)),
```

- [ ] **Step 4: Wire HTTP route exposure**

Confirm `packages/server/src/effect/http-app.ts` does NOT need a route table change — the `rpcHandler` dispatches by method name through `services[method]`, so the new methods become callable as soon as `KloviServicesShape` exposes them. Run a typecheck to confirm:

Run: `cd packages/server && bun run typecheck && cd ../../apps/desktop && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/shared/desktop-contract.ts \
	packages/ui/src/shared/types.ts \
	apps/desktop/src/bun/rpc-handlers.ts \
	apps/desktop/src/bun/index.ts
git commit -m "feat(desktop): wire getSessionHead and getSessionTail RPC handlers"
```

### Task 3b.4: Extend the Effect-based `kloviClient` with head/tail callers

Klovi's UI calls RPC methods through an **Effect-based** client (`packages/ui/src/lib/rpc-client.ts`), not Promise-based directly. We have to add `getSessionHead` and `getSessionTail` to that singleton AND to the default mock client used by tests.

**Files:**
- Modify: `packages/ui/src/lib/rpc-client.ts`
- Modify: `packages/ui/src/app/test-helpers/mock-rpc.ts`

- [ ] **Step 1: Add the two methods to `kloviClient` in `rpc-client.ts`**

In `packages/ui/src/lib/rpc-client.ts`, extend the `kloviClient` object literal (alphabetical position — between `getSession` and `getSessions`):

```ts
export const kloviClient = {
	acceptRisks: () => callClient("acceptRisks"),
	getGeneralSettings: () => callClient("getGeneralSettings"),
	getPluginSettings: () => callClient("getPluginSettings"),
	getProjects: () => callClient("getProjects"),
	getSession: (params) => callClient("getSession", params),
	getSessionHead: (params) => callClient("getSessionHead", params),
	getSessionTail: (params) => callClient("getSessionTail", params),
	getSessions: (params) => callClient("getSessions", params),
	getStats: () => callClient("getStats"),
	getSubAgent: (params) => callClient("getSubAgent", params),
	getVersion: () => callClient("getVersion"),
	isFirstLaunch: () => callClient("isFirstLaunch"),
	resetSettings: () => callClient("resetSettings"),
	searchSessions: () => callClient("searchSessions"),
	updateGeneralSettings: (params) => callClient("updateGeneralSettings", params),
	updatePluginSetting: (params) => callClient("updatePluginSetting", params),
} satisfies EffectfulKloviClient;
```

(`callClient<K>` is fully generic — no further type plumbing needed once `DesktopClientRequestMap` from Task 3b.3 includes the two methods.)

- [ ] **Step 2: Add the two methods to the default mock client in `mock-rpc.ts`**

In `packages/ui/src/app/test-helpers/mock-rpc.ts`, extend the `createMockClient` defaults so other component tests don't break when they render `SessionView`:

```ts
function createMockClient(overrides: MockClientOverrides = {}): KloviClient {
	return {
		acceptRisks: () => Promise.resolve({ ok: true }),
		isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
		getVersion: () => Promise.resolve({ version: "test", commit: "abc123" }),
		getStats: () =>
			Promise.resolve({
				stats: {
					projects: 0, sessions: 0, messages: 0, todaySessions: 0, thisWeekSessions: 0,
					inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
					toolCalls: 0, models: {},
				},
				refreshing: false,
			}),
		getProjects: () => Promise.resolve({ projects: [] }),
		getSessions: () => Promise.resolve({ sessions: [] }),
		getSession: () => Promise.resolve({ session: { sessionId: "", project: "", turns: [] } }),
		getSessionHead: () =>
			Promise.resolve({ session: { sessionId: "", project: "", turns: [] }, totalTurns: 0 }),
		getSessionTail: () => Promise.resolve({ turns: [] }),
		getSubAgent: () => Promise.resolve({ session: { sessionId: "", project: "", turns: [] } }),
		searchSessions: () => Promise.resolve({ sessions: [] }),
		getPluginSettings: () => Promise.resolve({ plugins: [] }),
		updatePluginSetting: () => Promise.resolve({ plugins: [] }),
		getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		updateGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		resetSettings: () => Promise.resolve({ ok: true }),
		...overrides,
	} as KloviClient;
}
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `cd packages/ui && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/lib/rpc-client.ts packages/ui/src/app/test-helpers/mock-rpc.ts
git commit -m "feat(ui): add getSessionHead and getSessionTail to client and mock"
```

### Task 3b.5: Rewrite `useSessionData` to fire head + tail in parallel

**Files:**
- Modify: `packages/ui/src/app/hooks/useSessionData.ts`
- Create: `packages/ui/src/app/hooks/useSessionData.test.tsx`

- [ ] **Step 1: Write a failing test for the parallel-fire behaviour**

Create `packages/ui/src/app/hooks/useSessionData.test.tsx`:

```tsx
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Session, Turn } from "../../shared/types.ts";
import { MockProviders, setupMockRPC } from "../test-helpers/mock-rpc.ts";
import { useSessionData } from "./useSessionData.ts";

afterEach(cleanup);

function makeTurn(i: number): Turn {
	return { kind: "user", uuid: `t-${i}`, timestamp: "2025-01-15T10:00:00Z", text: `m ${i}` } as Turn;
}

describe("useSessionData two-phase load", () => {
	test("fires head and tail in parallel", () => {
		const headTurns = [makeTurn(0), makeTurn(1)];
		const headFn = mock(() =>
			Promise.resolve({
				session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
				totalTurns: 3,
			}),
		);
		const tailFn = mock(() => Promise.resolve({ turns: [makeTurn(2)] }));
		setupMockRPC({ getSessionHead: headFn, getSessionTail: tailFn });

		renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		expect(headFn).toHaveBeenCalledTimes(1);
		expect(tailFn).toHaveBeenCalledTimes(1);
		expect(headFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", headSize: 100 });
		expect(tailFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", fromTurn: 100 });
	});

	test("renders head turns first, then appends tail", async () => {
		const headTurns = Array.from({ length: 100 }, (_, i) => makeTurn(i));
		const tailTurns = Array.from({ length: 50 }, (_, i) => makeTurn(100 + i));
		setupMockRPC({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: 150,
				}),
			getSessionTail: () => Promise.resolve({ turns: tailTurns }),
		});

		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(150));
		const turnIds = result.current.data?.session.turns.map((t) => t.uuid) ?? [];
		expect(turnIds[0]).toBe("t-0");
		expect(turnIds[149]).toBe("t-149");
	});

	test("renders head even if tail is still pending", async () => {
		const headTurns = [makeTurn(0), makeTurn(1)];
		setupMockRPC({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: 50,
				}),
			getSessionTail: () => new Promise(() => {}), // never resolves
		});
		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });
		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(2));
		expect(result.current.loading).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test — should FAIL**

Run: `cd packages/ui && bun test src/app/hooks/useSessionData.test.tsx`
Expected: FAIL — current hook only calls `getSession`.

- [ ] **Step 3: Replace `useSessionData` body to fork two effects via the runtime**

Replace `packages/ui/src/app/hooks/useSessionData.ts` with:

```ts
import { Cause, Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { useKloviClient, useKloviRuntime } from "../../lib/context.ts";
import { normalizeRpcError, type RpcError } from "../../lib/rpc-errors-effect.ts";
import type { Session } from "../../shared/types.ts";
import { useEffectQuery } from "./useEffectQuery.ts";

const HEAD_SIZE = 100;

type SessionDataResult = {
	data: { session: Session } | null;
	loading: boolean;
	error: RpcError | null;
	retry: () => void;
};

export function useSessionData(sessionId: string, project: string): SessionDataResult {
	const client = useKloviClient();
	const runtime = useKloviRuntime();

	const head = useEffectQuery<{ session: Session; totalTurns: number }>(
		() => client.getSessionHead({ sessionId: sessionId, project: project, headSize: HEAD_SIZE }),
		[client, sessionId, project],
	);

	const [tailTurns, setTailTurns] = useState<Session["turns"] | null>(null);
	const [tailError, setTailError] = useState<RpcError | null>(null);

	useEffect(() => {
		setTailTurns(null);
		setTailError(null);
		const fiber = runtime.runFork(
			client.getSessionTail({ sessionId: sessionId, project: project, fromTurn: HEAD_SIZE }).pipe(
				Effect.matchCauseEffect({
					onFailure: (cause) =>
						Effect.sync(() => {
							const failure = Cause.failureOption(cause);
							setTailError(normalizeRpcError(failure._tag === "Some" ? failure.value : Cause.pretty(cause)));
						}),
					onSuccess: (result) =>
						Effect.sync(() => {
							setTailTurns(result.turns);
						}),
				}) as Effect.Effect<void, never, never>,
			),
		);
		return () => {
			Effect.runFork(Fiber.interrupt(fiber));
		};
	}, [client, runtime, sessionId, project]);

	const session = head.data?.session;
	const merged = session
		? tailTurns
			? { ...session, turns: [...session.turns, ...tailTurns] }
			: session
		: null;

	return {
		data: merged ? { session: merged } : null,
		loading: head.loading,
		error: head.error ?? tailError,
		retry: head.retry,
	};
}

export function useSubAgentSessionData(sessionId: string, project: string, agentId: string) {
	const client = useKloviClient();
	return useEffectQuery<{ session: Session }>(
		() => client.getSubAgent({ sessionId: sessionId, project: project, agentId: agentId }),
		[client, sessionId, project, agentId],
	);
}
```

(Note: `head.loading` is the gate for the very first paint — once head resolves, the user sees content. Tail errors are surfaced via `error` but don't block the render of the head content. The existing `useSubAgentSessionData` is preserved unchanged.)

- [ ] **Step 4: Run the hook tests**

Run: `cd packages/ui && bun test src/app/hooks/useSessionData.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run all ui tests**

Run: `cd packages/ui && bun run check`
Expected: PASS. The existing `SessionView.test.tsx` should still pass because `getSession` is still part of `kloviClient` (we kept it for back-compat in Task 3b.1) and the default mock provides `getSessionHead`/`getSessionTail`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/app/hooks/useSessionData.ts packages/ui/src/app/hooks/useSessionData.test.tsx
git commit -m "feat(ui): two-phase session load — render head, append tail"
```

---

## §4b — Virtualize SessionList and ProjectList

**Goal:** Render only the visible session/project rows so users with hundreds of projects/sessions don't pay for off-screen DOM.

### Task 4b.1: Virtualize `SessionList`

**Files:**
- Modify: `packages/ui-components/src/sessions/SessionList.tsx`
- Create: `packages/ui-components/src/sessions/SessionList.test.tsx`

- [ ] **Step 1: Write a failing render test for the windowed list**

Create `packages/ui-components/src/sessions/SessionList.test.tsx`:

```tsx
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { SessionSummary } from "../types/index.ts";
import { SessionList } from "./SessionList.tsx";

afterEach(cleanup);

function makeSession(i: number): SessionSummary {
	return {
		sessionId: `s-${i}`,
		timestamp: "2025-01-15T10:00:00Z",
		slug: `slug-${i}`,
		firstMessage: `message ${i}`,
		model: "claude-sonnet-4-5-20250929",
		gitBranch: "main",
		pluginId: "claude-code",
	};
}

describe("SessionList virtualization", () => {
	test("renders only a windowed slice for large session lists", () => {
		const sessions = Array.from({ length: 500 }, (_, i) => makeSession(i));
		const { container } = render(
			<div style={{ height: 600, width: 320 }}>
				<SessionList projectName="/Users/dev/x" sessions={sessions} onBack={mock()} onSelect={mock()} />
			</div>,
		);
		const items = container.querySelectorAll("[data-session-id]");
		expect(items.length).toBeLessThan(50);
		expect(items.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run — should FAIL**

Run: `cd packages/ui-components && bun test src/sessions/SessionList.test.tsx`
Expected: FAIL — items lack `data-session-id` attributes / list is not windowed yet.

- [ ] **Step 3: Virtualize `SessionList`**

In `packages/ui-components/src/sessions/SessionList.tsx`:

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
// ... existing imports

const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const SESSION_ROW_HEIGHT = 56;

function SessionList({
	sessions,
	loading,
	error,
	onRetry,
	selectedId,
	projectName,
	onSelect,
	onBack,
	pluginDisplayName = defaultPluginDisplayName,
}: SessionListProps) {
	const parts = projectName.split("/").filter(Boolean);
	const displayName = parts.slice(-2).join("/");
	const parentRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: sessions.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => SESSION_ROW_HEIGHT,
		overscan: 8,
	});

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading sessions...</div>;
	}
	if (error) {
		return <FetchError error={error} {...(onRetry ? { onRetry: onRetry } : {})} />;
	}

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<button type="button" className={BACK_BTN_CLASSES} onClick={onBack}>
				← Projects
			</button>
			<div className={SECTION_TITLE_CLASSES}>{displayName}</div>
			{sessions.length === 0 ? (
				<div className={EMPTY_MESSAGE_CLASSES}>No sessions found</div>
			) : (
				<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
					{virtualizer.getVirtualItems().map((item) => {
						const session = sessions[item.index];
						if (!session) {
							return null;
						}
						return (
							<div
								key={session.sessionId}
								data-session-id={session.sessionId}
								data-index={item.index}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									transform: `translateY(${item.start}px)`,
								}}
							>
								<SessionItem
									session={session}
									isActive={selectedId === session.sessionId}
									onSelect={onSelect}
									pluginDisplayName={pluginDisplayName}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ui-components && bun test src/sessions/SessionList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-components/src/sessions/SessionList.tsx packages/ui-components/src/sessions/SessionList.test.tsx
git commit -m "perf(ui-components): virtualize SessionList"
```

### Task 4b.2: Virtualize `ProjectList`

**Files:**
- Modify: `packages/ui-components/src/sessions/ProjectList.tsx`
- Modify: `packages/ui-components/src/sessions/ProjectList.test.tsx`

- [ ] **Step 1: Add a failing render test for the windowed list**

Append to `packages/ui-components/src/sessions/ProjectList.test.tsx`:

```tsx
test("renders only a windowed slice for large filtered project lists", () => {
	const projects = Array.from({ length: 400 }, (_, i) =>
		makeProject({ encodedPath: `p-${i}`, name: `/Users/dev/proj-${i}` }),
	);
	const { container } = render(
		<div style={{ height: 600, width: 320 }}>
			<ProjectList
				projects={projects}
				hiddenIds={new Set()}
				onSelect={mock()}
				onHide={mock()}
				onShowHidden={mock()}
			/>
		</div>,
	);
	const items = container.querySelectorAll("[data-project-encoded-path]");
	expect(items.length).toBeLessThan(50);
	expect(items.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run — should FAIL**

Run: `cd packages/ui-components && bun test src/sessions/ProjectList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Virtualize `ProjectList`**

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
// ... existing imports

const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const PROJECT_ROW_HEIGHT = 56;

function ProjectList({
	projects,
	loading,
	error,
	onRetry,
	selectedId,
	hiddenIds,
	onSelect,
	onHide,
	onShowHidden,
	filter = "",
	onFilterChange,
}: ProjectListProps) {
	const handleFilterChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onFilterChange?.(e.target.value),
		[onFilterChange],
	);
	const parentRef = useRef<HTMLDivElement>(null);

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading projects...</div>;
	}
	if (error) {
		return (
			<div className={FETCH_ERROR_CLASSES}>
				<span className={FETCH_ERROR_MESSAGE_CLASSES}>{error}</span>
				{onRetry ? (
					<Button size="sm" onClick={onRetry}>
						Retry
					</Button>
				) : null}
			</div>
		);
	}

	const filtered = projects.filter(
		(p) =>
			!hiddenIds.has(p.encodedPath) &&
			(p.name.toLowerCase().includes(filter.toLowerCase()) ||
				p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
	);

	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => PROJECT_ROW_HEIGHT,
		overscan: 8,
	});

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<input
				className={FILTER_INPUT_CLASSES}
				placeholder="Filter projects..."
				value={filter}
				onChange={handleFilterChange}
			/>
			<div className={SECTION_TITLE_CLASSES}>Projects ({filtered.length})</div>
			{filtered.length === 0 ? (
				<div className={EMPTY_MESSAGE_CLASSES}>No projects found</div>
			) : (
				<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
					{virtualizer.getVirtualItems().map((item) => {
						const project = filtered[item.index];
						if (!project) {
							return null;
						}
						return (
							<div
								key={project.encodedPath}
								data-project-encoded-path={project.encodedPath}
								data-index={item.index}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									transform: `translateY(${item.start}px)`,
								}}
							>
								<ProjectItem
									project={project}
									isActive={selectedId === project.encodedPath}
									onSelect={onSelect}
									onHide={onHide}
								/>
							</div>
						);
					})}
				</div>
			)}
			{hiddenIds.size > 0 && (
				<button type="button" className={HIDDEN_PROJECTS_LINK_CLASSES} onClick={onShowHidden}>
					{hiddenIds.size} hidden project{hiddenIds.size === 1 ? "" : "s"}
				</button>
			)}
		</div>
	);
}
```

(Note: `useVirtualizer` must be called unconditionally above any conditional return. Move the loading/error early-returns *below* the hook calls if React's rule-of-hooks complains. Confirmed pattern: hook calls first, then early returns.)

Refactor accordingly:

```tsx
function ProjectList(props: ProjectListProps) {
	const { /* destructure */ } = props;
	const handleFilterChange = useCallback(...);
	const parentRef = useRef<HTMLDivElement>(null);
	const filtered = (loading || error) ? [] : projects.filter(...);
	const virtualizer = useVirtualizer({ count: filtered.length, ... });

	if (loading) { return <div className={LOADING_CLASSES}>Loading projects...</div>; }
	if (error) { /* return error UI */ }
	// ... main render
}
```

- [ ] **Step 4: Run all `ProjectList` tests**

Run: `cd packages/ui-components && bun test src/sessions/ProjectList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-components/src/sessions/ProjectList.tsx packages/ui-components/src/sessions/ProjectList.test.tsx
git commit -m "perf(ui-components): virtualize ProjectList filtered slice"
```

---

## Final Verification

### Task F.1: Run all repo checks

- [ ] **Step 1: Lint, typecheck, full test run**

Run: `bun run lint && bun run typecheck && bun test`
Expected: all PASS. Fix any cross-package failures.

- [ ] **Step 2: Smoke-test the desktop app**

Run: `bun run dev`
Open the app, navigate Projects → Session list → open a long session. Confirm:
- Project list scrolls smoothly with hundreds of projects (test with a synthetic dataset if needed).
- Session list opens within a frame of clicking a project.
- Long sessions render the head immediately and append the tail without a scroll jump.

- [ ] **Step 3: Spec/CLAUDE.md verification**

Run: `bun run test:node-smoke && bun run stage:npm && bun run verify:packed-artifact`
Expected: all PASS. (These are the standard release checks per CLAUDE.md.)

- [ ] **Step 4: No-cache audit**

Run: `grep -nE 'new Map\(|cachePath|cacheAt|memoize|cache' --include='*.ts' --include='*.tsx' -r packages apps | grep -v stats-cache | grep -v test`
Manually inspect each remaining hit to confirm no new in-memory or file caches were introduced (the existing `stats-cache.json` and its module are exempt). The search is heuristic — read each match and explicitly confirm it is not a cache.

- [ ] **Step 5: Final commit (if any clean-up touched)**

```bash
git add -p
git commit -m "chore: post-implementation polish"
```

---

## Cross-Section Dependencies (recap)

Implementation order: **§1 → §2 → §3a → §4a → §3b → §4b**.

- §1 must precede §2 to maximize the parallelism win (without `streamJsonlHead`, parallel reads are still loading whole files).
- §3a must precede §3b (head+tail loaders share the streaming `loadClaudeSession`).
- §4a must precede §3b (so the tail-append path lands on a virtualized list from day one).
- §4b is independent and can be deferred without blocking anything.

## Verification Snippets

After every Task above, run the package-local checks:

```sh
bun run lint
bun run typecheck
bun test
```

If any check fails, fix the issue and re-run until green before moving to the next Task.
