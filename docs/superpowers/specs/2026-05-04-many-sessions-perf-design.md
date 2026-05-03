# Many-Sessions Performance Design (Approach 1)

**Date:** 2026-05-04
**Status:** Approved for implementation planning
**Scope:** Make Klovi feel responsive for users with many sessions, by attacking discovery IO, parallelism, session-load latency, and long-list rendering — without introducing new caches.

## Motivation

On a representative user environment (this developer's machine):

- Claude Code: **38 projects, 1,950 jsonl files, 816 MB**. Heaviest project (Klovi) holds 22 top-level sessions + 613 subagent files (635 files in one directory).
- Codex: **738 jsonl files, 2.1 GB**, 82 files larger than 1 MB.
- Cursor: handful of agent transcripts.
- Combined: **~2,700+ jsonl files**, 41 files exceed the per-session metadata-read budget.

Reported pain points (multi-select):

- **A.** Cold dashboard load
- **B.** Project click → session list appearance
- **D.** Opening a single big session
- **F.** Re-navigating between views (every back-and-forth feels like a fresh load)

Search (E) and project filter (C) were not flagged as slow.

## Out of Scope

- **Pain point F (re-navigation cost).** Eliminating this requires either a derived index (e.g. SQLite) or shared in-memory state that survives navigation. Both are arguably caching, which conflicts with the project rule. F is deferred to a later round.
- **Search performance (E).** Not flagged as a current pain.
- **Project-filter input responsiveness (C).** Not flagged as a current pain.
- **Removing the existing `stats-cache.json`.** The pre-existing cache and its companion code stay untouched in this round. The "no caching" rule's interaction with that file is a separate decision.

## Hard Constraint

CLAUDE.md (project rule): **"Never implement caching in this project. No in-memory caches, file-based caches, DB cache tables, HTTP cache layers, memoization caches, or TTL-based cache logic."**

This design adds zero new persistent state. All wins come from cheaper reads, parallelism, smaller IPC payloads, and windowed rendering. The pre-existing `stats-cache.json` is not modified or extended.

## Current State (relevant hot paths)

```
packages/plugin-claude-code/src/discovery.ts
  discoverClaudeProjects()      sequential `for` over project dirs
    → inspectProjectSessions()  sequential `for` over session files (bails after first cwd hit)
  listClaudeSessions()          sequential `for` over session files
    → extractSessionMeta()      readTextPrefix(filePath, 1MB) + iterateJsonl

packages/plugin-claude-code/src/shared/discovery-utils.ts
  readTextPrefix(filePath, n)   ⚠ fs.readFile() (whole file) then .subarray(0, n)
                                  the n-byte cap is fake; full file is loaded into memory
  listFilesWithMtime(dir, ext)  sequential `for` calling fs.stat per file

packages/plugin-claude-code/src/parser.ts
  loadClaudeSession()           readJsonlLines() → buildTurns() → returns full Turn[]
  readJsonlLines(filePath)      readFileText() (full file) then text.split("\n") then per-line JSON.parse

packages/plugin-core/src/plugin-registry.ts
  discoverPluginStates()        sequential `for` over registered plugins

packages/server/src/services/sessions-service.ts
  getSession(...)               single RPC returning the entire Turn[] in one payload

packages/ui-components/src/messages/MessageList.tsx
  turns.map(renderTurn)         every turn mounted into the DOM, no virtualization

packages/ui-components/src/sessions/SessionList.tsx
  sessions.map(...)             every session mounted, no virtualization

packages/ui-components/src/sessions/ProjectList.tsx
  filtered.map(...)             every project mounted, no virtualization
```

## Architecture

Four independent changes. Each is shippable in isolation; later sections depend on earlier ones to not regress (specifically: §3b requires §4a).

```
                   ┌─────────────────────────────────────────┐
                   │ UI (packages/ui-components)             │
                   │  ┌──────────────────────┐               │
                   │  │ MessageList (D) §4a  │ virtualized   │
                   │  │ SessionList (B) §4b  │ virtualized   │
                   │  │ ProjectList     §4b  │ virtualized   │
                   │  └──────────────────────┘               │
                   │           ▲ head + tail                 │
                   └───────────┼─────────────────────────────┘
                               │ RPC (request/response, no streaming)
        ┌──────────────────────┼─────────────────────────┐
        │ Server (packages/server, packages/plugin-*)    │
        │  ┌────────────────────────────────────────┐    │
        │  │ getSessionHead / getSessionTail §3b    │    │
        │  │ loadClaudeSession (streaming) §3a      │    │
        │  │ listClaudeSessions parallel §2         │    │
        │  │ discoverClaudeProjects parallel §2     │    │
        │  └────────────────────────────────────────┘    │
        │           ▲                                     │
        │   ┌───────┴─────────────────┐                   │
        │   │ NEW: streamJsonlHead §1 │  bail-early,      │
        │   │   in plugin-core        │  Effect Stream    │
        │   │   (replaces             │  over Effect      │
        │   │   readTextPrefix)       │  Platform fs      │
        │   └─────────────────────────┘                   │
        └─────────────────────────────────────────────────┘
```

Implementation order: **§1 → §2 → §3a → §4a → §3b → §4b**. §4a precedes §3b so the tail-append path lands on a virtualized list from day one. See the cross-section dependency table at the end of this document.

## §1 — Bail-early streaming metadata read

### Problem

`readTextPrefix(filePath, maxBytes)` calls `fs.readFile(filePath)` then `.subarray(0, maxBytes)`. The `maxBytes` cap is misleading — every metadata extraction loads the entire file into memory before slicing. A 50 MB session causes a 50 MB read just to extract its first-line timestamp.

### Change

Add a new primitive in **`packages/plugin-core/src/jsonl-stream.ts`** (placed in plugin-core so codex/cursor can reuse it):

```ts
streamJsonlHead(
  filePath: string,
  visitor: (ctx: JsonlLineContext) => unknown,  // return false to bail
  options?: { maxLines?: number; maxBytes?: number },
): Effect.Effect<void, PlatformError, FileSystem.FileSystem>
```

Implementation uses Effect Platform's `FileSystem.stream` (available in `@effect/platform@0.96.1`, the version pinned across packages):

```ts
fs.stream(filePath, { chunkSize: 8 * 1024 })          // 8 KB chunks for head reads
  .pipe(Stream.decodeText("utf-8"))
  .pipe(Stream.splitLines)
  .pipe(Stream.take(options.maxLines ?? Infinity))
  .pipe(Stream.takeUntil(line => visitorReturnsFalse))
  .pipe(Stream.runForEach(line => Effect.sync(parseAndVisit)))
```

Bailing closes the underlying file handle automatically through Effect Stream's resource scoping. `maxBytes` is a defensive cap implemented via `Stream.scan` over byte counts; it can be omitted if `maxLines` is sufficient (it usually is — metadata is in lines 1–10).

### Migration

`readTextPrefix` exists in **two plugin packages** with identical implementations:

- `packages/plugin-claude-code/src/shared/discovery-utils.ts`
- `packages/plugin-codex/src/shared/discovery-utils.ts`

Both are migrated in this round (codex has 738 jsonl files in the representative install — same pain shape).

- **Claude Code**: `extractSessionMeta` and `extractCwd` in `packages/plugin-claude-code/src/discovery.ts` switch from `readTextPrefix` + `iterateJsonl` to `streamJsonlHead`. Same visitor logic, same bail conditions, same outputs.
- **Codex**: callers of `readTextPrefix` in `packages/plugin-codex/src/discovery.ts` (line 107: session-title scan) switch to `streamJsonlHead`. Same visitor logic.
- **Cursor**: not migrated in this round — no `readTextPrefix` call. (`packages/plugin-cursor` uses `readFileText` for full-file parses, addressed indirectly by §3a's full-file streaming primitive, which Cursor's parsers can adopt opportunistically.)

The existing `iterateJsonl` helper stays for callers that legitimately operate on a string already (e.g. test fixtures).

Both copies of `readTextPrefix` are removed once no callers remain. The two copies are not consolidated into `plugin-core` in this round — only the new `streamJsonlHead` lives there.

### Tests

- Existing `extractSessionMeta` tests stay green (output-equivalent).
- New `jsonl-stream.test.ts` constructs a 5 MB synthetic JSONL with metadata in line 2, asserts the visitor sees the metadata, and asserts the stream completes after a small bounded number of chunks (via a `Ref` counter incremented in the visitor).
- Use Effect Platform's in-memory `FileSystem` test layer for deterministic assertions.

### Expected impact

For a typical session (metadata in first ~5 lines): cost goes from "read entire file" to "read ~2 KB". For Klovi's 22-session top-level dir, listing IO drops from ~25 MB to ~50 KB.

## §2 — Bounded parallelism in discovery

### Problem

Sequential `for...of yield*` loops execute even though each iteration is an independent IO operation. After §1 makes individual reads tiny, round-trip count dominates.

Loops in scope (Claude Code, Codex, and the shared registry):

| Location | Loop | Worst case |
|---|---|---|
| `packages/plugin-claude-code/src/discovery.ts:44` `discoverClaudeProjects` | over project dirs | 38 dirs |
| `packages/plugin-claude-code/src/discovery.ts:26` `inspectProjectSessions` | over session files (bails after first cwd hit) | up to N |
| `packages/plugin-claude-code/src/discovery.ts:82` `listClaudeSessions` | calls `extractSessionMeta` per file | 22–44 sessions |
| `packages/plugin-claude-code/src/shared/discovery-utils.ts:64` `listFilesWithMtime` | `fs.stat` per file | up to N |
| `packages/plugin-codex/src/discovery.ts` (sessions, byCwd, matching loops at lines 32, 42, 44, 104) | sequential per-session work | 738 sessions on representative install |
| `packages/plugin-codex/src/shared/discovery-utils.ts:17` | `fs.stat`/dir-walk per entry | up to N |
| `packages/plugin-core/src/plugin-registry.ts:103` `discoverPluginStates` | over registered plugins | 4 plugins |

### Change

Replace each loop with `Effect.forEach(items, fn, { concurrency: N })`. Concurrency budgets, expressed as named constants at the top of each module:

| Loop | Concurrency | Rationale |
|---|---|---|
| Plugins (`discoverPluginStates`) | `"unbounded"` | only 4 plugins; isolated config layers |
| Project dirs (`discoverClaudeProjects`, codex equivalent) | `16` | bounded so 100+ project trees don't fork-bomb FS |
| Session files (`listClaudeSessions`, codex per-session loops) | `16` | safely under macOS 256-fd default; saturates SSD |
| `fs.stat` (`listFilesWithMtime`, codex equivalent) | `32` | stats are very cheap; high concurrency is fine |

### Bonus: refactor `inspectProjectSessions`

Today's loop reads `extractCwd` per session file but bails after the first non-empty result. Since `sessionFiles` is sorted newest-first, the first file almost always has a `cwd`. Replace the loop with: try the newest file; only fall back to next on empty result. Removes up to N reads per project. Combined with §1 this is a single 8 KB stream per project.

### Tests

- Existing discovery tests stay green (concurrency does not change outputs).
- Add an ordering test: confirm `sortByIsoDesc` is applied **after** the parallel collection — `Effect.forEach` preserves input order in its result array, but timing across the work is no longer monotonic, so sort is the source of truth.

### Expected impact

Klovi project listing: `22 × stream-bail` → `ceil(22 / 16) × stream-bail`. Cold dashboard scan benefits proportionally because `scanStats` traverses the same shapes.

## §3a — Server-side streaming session parse

### Scope

Claude Code's `loadClaudeSession` is the focus. Codex (`packages/plugin-codex/src/parser.ts`) and Cursor (`packages/plugin-cursor/src/parser.ts`) have similar shapes and benefit from the new `streamJsonl` primitive, but their parser migrations are deferred to a follow-up — the immediate session-open pain is dominated by Claude Code's session sizes and call frequency.

### Problem

`readJsonlLines` calls `readFileText` (full-file string) then `text.split("\n")` (allocates a line array), then iterates. Both allocations are sized to the file. A 50 MB session allocates a 50 MB Buffer, a 50 MB string, and a large line array — and synchronously blocks the event loop during parse.

### Change

Add `streamJsonl(filePath, visitor)` to `packages/plugin-core/src/jsonl-stream.ts` (sibling to §1's `streamJsonlHead`, no `take`/`takeUntil`).

Replace `readJsonlLines` body to use `streamJsonl`:

```ts
function readJsonlLines(filePath: string) {
  return Effect.gen(function* () {
    const rawLines: RawLine[] = [];
    const parseErrors: ParseErrorTurn[] = [];
    yield* streamJsonl(filePath, ({ parsed, line, lineNumber }) => {
      if (parsed === MALFORMED) {
        parseErrors.push({ /* same as today */ });
        return;
      }
      rawLines.push(parsed as RawLine);
    });
    return { rawLines, parseErrors };
  });
}
```

`buildTurns` is unchanged — it requires the full array for cross-line subagent attachment.

### Tests

Existing parser tests stay green. Add a memory-pressure test that asserts a synthetic 100 MB session does not allocate a 100 MB intermediate string (assert peak `process.memoryUsage().heapUsed` delta).

### Expected impact

Lower peak server memory; cooperative event loop (chunks yield naturally between `Stream.runForEach` ticks). Does not reduce IPC payload size — that is §3b.

## §3b — Two-phase session-load RPC

### Problem

Even with §3a, a single RPC returning the entire `Turn[]` for a 5,000-turn session must serialize, send, and deserialize the whole payload before the client can render anything. JSON-stringify + IPC + JSON-parse is hundreds of ms regardless of parse speed.

### Change

Split `getSession` into two request/response RPCs (no streaming, no SSE, no subscriptions — same transport shape as today):

```ts
getSessionHead({ sessionId, project, headSize: 100 })
  → { session: Session<turns 0..99>, totalTurns, planSessionId, implSessionId }

getSessionTail({ sessionId, project, fromTurn: 100 })
  → { turns: Turn[] }
```

Both RPCs reuse the same `loadClaudeSession` logic; the head response slices the first `headSize` turns, the tail response returns the remainder.

### Client behaviour

`packages/ui/src/app/hooks/useSessionData.ts` is updated:

1. On mount, fire `getSessionHead` and `getSessionTail` in parallel.
2. As soon as head resolves, render. User sees session start immediately.
3. When tail resolves, append turns to the rendered list. Virtualizer (§4a) keeps append cheap and pins scroll position.

### Constants

`HEAD_SIZE = 100` — covers ~3 viewport heights of typical content. Low enough to be fast to serialize, high enough to satisfy users on small/medium sessions in a single read. Configurable as a module-level constant.

### Trade-offs

- Each open performs **two file reads instead of one**. OS page cache makes the second read effectively a memcpy after the first; parse cost is paid twice but the head parses only ~100 lines.
- For tiny sessions the second RPC is wasted work. Acceptable — the cost is negligible at small sizes, and the code stays uniform.

### Why not push streaming

The existing transport is request/response (Electrobun typed RPC + HTTP fetch). Push channels exist only via `KloviHostBridge` for status events (`onStatsUpdated`, `onConnectionState`). Adding SSE for browser mode and a streaming RPC for desktop mode is a multi-day transport refactor and belongs in a later round if §3b proves insufficient.

### RPC contract changes

- **`packages/ui/src/lib/client.ts`** — add `getSessionHead` and `getSessionTail` methods to `KloviClient`. Keep `getSession` as a thin compose of head+tail until all callers migrate; remove in a follow-up.
- **`packages/server/src/services/sessions-service.ts`** — add corresponding handlers.
- **`apps/desktop/src/shared/rpc-types.ts`** and **HTTP routes in `packages/server/src/effect/http-app.ts`** — register new endpoints.

### Tests

- Service tests for `getSessionHead` (asserts `totalTurns` is correct, `turns.length === min(headSize, totalTurns)`).
- Service test for `getSessionTail` (asserts `fromTurn` slicing is correct, including `fromTurn >= totalTurns` returning empty).
- Hook test for `useSessionData` (asserts both RPCs fired in parallel, head renders before tail, tail appends without dropping head turns).

### Expected impact

Time-to-first-paint on big sessions drops from "load full payload" to "load first 100 turns" — typically 10–50× depending on session size.

## §4a — Virtualize MessageList

### Problem

`MessageList.tsx` mounts every turn into the DOM. Each turn renders markdown, code blocks with syntax highlighting, tool outputs, and diffs. A 5,000-turn session mounts 5,000 React subtrees on initial render and again on tail-append from §3b.

### Change

Adopt **`@tanstack/react-virtual`** (~3 KB gzip, hooks-based, supports variable-height via `measureElement`). Bun-friendly, no native deps.

`MessageList.tsx` becomes:

```tsx
const parentRef = useRef<HTMLDivElement>(null);
const firstUserTurnIndex = useMemo(() => /* current findIndex */, [turns]);

const virtualizer = useVirtualizer({
  count: turns.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,
  overscan: 5,
  measureElement: el => el.getBoundingClientRect().height,
});

return (
  <div ref={parentRef} className="overflow-auto h-full">
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map(v => (
        <div
          key={turns[v.index].uuid ?? v.index}
          ref={virtualizer.measureElement}
          data-index={v.index}
          style={{
            position: "absolute",
            top: 0,
            transform: `translateY(${v.start}px)`,
            width: "100%",
          }}
        >
          <ErrorBoundary inline>{renderTurn(...)}</ErrorBoundary>
        </div>
      ))}
    </div>
  </div>
);
```

### Edge cases

1. **Scroll-to-bottom on first load.** Today the natural document flow positions the user at the top; long sessions are read top-down. Virtualization preserves this.
2. **Anchor on §3b tail append.** When `getSessionTail` resolves and turns 100..N append, the user must not get scroll-jumped. Pin scroll position via `virtualizer.scrollOffset` before append, restore after.
3. **Active-message highlight.** During presentation mode, `MessageList` flags the last turn as active. The virtualizer must scroll-into-view when `visibleSubSteps` changes to a new index: `virtualizer.scrollToIndex(index, { align: "center" })`.
4. **`firstUserTurnIndex` lookup.** Currently a `findIndex` at render time. Move to `useMemo` so it does not run per virtual-item re-render.

### Tests

`MessageList` tests run with happy-dom, which has no real layout. `useVirtualizer` requires non-zero scroll-element height. Tests set a fixed height + width on the scroll container in `beforeEach` so the virtualizer code path runs; this preserves coverage of the new render path.

## §4b — Virtualize SessionList and ProjectList

### Change

Same library, simpler implementation — items are roughly fixed-height (one-line title + meta line). `estimateSize: () => 56` works without `measureElement`.

The `ProjectList` filter input keeps its `.filter` over the array; virtualization happens after filtering, on the filtered slice.

### Why bother

Already cheap for the current worst case (44 sessions, 38 projects). Free with the same dependency, future-proofs against users with hundreds of projects.

## Cross-section dependencies

| Combined with | §1 | §2 | §3a | §3b | §4a | §4b |
|---|---|---|---|---|---|---|
| §1 | — | independent | independent | independent | independent | independent |
| §2 | needs §1 to maximize gain | — | independent | independent | independent | independent |
| §3a | independent | independent | — | required by §3b | independent | independent |
| §3b | independent | independent | requires §3a's stream | — | **required for §3b not to regress** | independent |
| §4a | independent | independent | independent | required to absorb tail-append | — | independent |
| §4b | independent | independent | independent | independent | independent | — |

**Implementation order**: §1 → §2 → §3a → §4a → §3b → §4b. §4a precedes §3b so the tail-append path lands on a virtualized list from day one.

## Verification

After every section, run:

```sh
bun run lint
bun run typecheck
bun test
```

Plus, per CLAUDE.md, the standard release checks before merging the full set:

```sh
bun run test:node-smoke
bun run stage:npm
bun run verify:packed-artifact
```

## Risks

- **§1's `Stream.splitLines` semantics on partial multi-byte UTF-8 boundaries.** Effect Stream's text decoder buffers across chunks, so multi-byte characters split across chunk boundaries decode correctly. Verified in tests.
- **§2's bounded concurrency value choices.** 16 is conservative; if profiling shows IO is not saturated we can raise it. Constants live at module top so tuning is trivial.
- **§3b's two-read overhead on small sessions.** Real-world profiling on a small session should confirm overhead is sub-frame; otherwise add a "single-read fast path" gated on `totalTurns < headSize`.
- **§4a's measure-on-render with markdown content that mounts asynchronously** (e.g. images loading). `measureElement` re-runs on `ResizeObserver`, so asynchronous height changes propagate; no special handling needed beyond verifying scroll-anchoring on slow image loads.

## Future Work (deferred)

- **Pain F (re-navigation)** — requires shared in-memory state across navigation OR a derived index. Both touch the no-caching rule and need a separate decision.
- **Search performance (E)** — currently calls `discoverAllProjectsWithSessions`. Same wins as §1 + §2 will apply transitively, but no dedicated work in this round.
- **Codex and Cursor parser migrations to `streamJsonl`** — same shape as §3a, deferred until Claude Code's pain is resolved and we measure remaining cost.
- **Consolidating the two `readTextPrefix` copies into `plugin-core`** once both are removed.
- **Code-splitting `MarkdownRenderer` and syntax highlighting.**
- **Lazy-loading images inside tool outputs.**
- **Removing or formalizing the existing `stats-cache.json`.**
