# Effect Everywhere — Phase 1: Server Service Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the server service layer (`settings.ts`, `stats.ts`, `auto-discover.ts`, `app-services.ts`) from async/await to Effect. Remove `runPluginEffect` / `runRegistryEffect` boundary functions. HTTP dispatcher calls handler Effects directly.

**Architecture:** Service methods return `Effect.Effect<A, DomainError, RegistryRequirements>`. The existing `BunContext.layer` in the server bootstrap already provides `FileSystem`; we extend `platformLayer` to also provide `SqliteClient` so the full runtime can satisfy `RegistryRequirements` directly. `KloviServicesShape` methods become Effects; `http-app.ts` yields from them directly. The `plugin-runtime.ts` module (boundary adapter) is deleted.

**Tech Stack:** TypeScript 6, Bun runtime, `effect` 3.21, `@effect/platform`, `@effect/platform-bun`, `@effect/platform-node`, `bun:test`.

**Spec reference:** `docs/superpowers/specs/2026-04-05-effect-everywhere-design.md` § Phase 1.

---

## File Structure

### Files Created
| Path | Purpose |
|------|---------|
| `packages/server/src/services/errors.ts` | Tagged domain errors (`Data.TaggedError`) |
| `packages/server/src/services/sessions-service.ts` | Projects, sessions, session detail, search Effects |
| `packages/server/src/services/settings-service.ts` | Plugin/general/update settings handler Effects |
| `packages/server/src/services/onboarding-service.ts` | First-launch, complete-onboarding, reset Effects |
| `packages/server/src/services/stats-service.ts` | Dashboard stats handler Effect (wraps stats.ts internals) |

### Files Modified
| Path | Change |
|------|--------|
| `packages/server/src/services/settings.ts` | `loadSettings`/`saveSettings` return Effects using `FileSystem` |
| `packages/server/src/services/stats.ts` | Aggregation functions return Effects |
| `packages/server/src/services/auto-discover.ts` | `createRegistry` returns Effect |
| `packages/server/src/effect/server-services.ts` | `KloviServicesShape` methods return Effects; layer yields from service Effects directly |
| `packages/server/src/effect/http-app.ts` | Dispatcher `yield*`s handler Effect; no `Effect.tryPromise` bridge |
| `packages/server/src/effect/platform-bun.ts` | Extend bun server layer to include SQLite |
| `packages/server/src/effect/platform-node.ts` | Extend node server layer to include SQLite |
| `packages/server/src/effect/bootstrap.ts` | Remove `setPluginLayer` call |
| `packages/server/src/services/settings.test.ts` | Effect-based test setup |
| `packages/server/src/services/app-services.test.ts` | Effect-based test setup |
| `packages/server/src/effect/server-services.test.ts` | Updated for Effect-returning service methods |

### Files Deleted
| Path | Reason |
|------|--------|
| `packages/server/src/services/app-services.ts` | Contents split into four new service modules |
| `packages/server/src/effect/plugin-runtime.ts` | Boundary functions no longer needed |

---

## Key Types and Conventions

**`RegistryRequirements`** (from `@cookielab.io/klovi-plugin-core`):
```ts
type RegistryRequirements = FileSystem.FileSystem | SqliteClientTag
```

**Service Effect signature convention:**
```ts
// Pure I/O, always succeeds (falls back to defaults on any failure)
Effect.Effect<Result, never, FileSystem.FileSystem>

// May fail with a specific domain error
Effect.Effect<Result, SessionNotFoundError | ProjectNotFoundError, RegistryRequirements>

// Plugin operations (need config layer provided per-plugin)
Effect.Effect<Result, PluginError, RegistryRequirements>
```

**Pattern for plugin calls with per-plugin config:**
```ts
import { makePluginConfigLayer } from "@cookielab.io/klovi-plugin-core"
const configLayer = makePluginConfigLayer(registry.getPluginConfig(pluginId))
const result = yield* plugin.loadSession(nativeId, rawSessionId).pipe(Effect.provide(configLayer))
```

---

## Task 1: Create Domain Error Types

**Files:**
- Create: `packages/server/src/services/errors.ts`
- Test: `packages/server/src/services/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/services/errors.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "./errors.ts";

describe("domain errors", () => {
	test("ProjectNotFoundError carries encodedPath", () => {
		const err = new ProjectNotFoundError({ encodedPath: "-Users-foo" });
		expect(err._tag).toBe("ProjectNotFoundError");
		expect(err.encodedPath).toBe("-Users-foo");
	});

	test("InvalidSessionIdError carries the raw value", () => {
		const err = new InvalidSessionIdError({ value: "bad" });
		expect(err._tag).toBe("InvalidSessionIdError");
		expect(err.value).toBe("bad");
	});

	test("PluginSourceNotFoundError carries plugin id and project", () => {
		const err = new PluginSourceNotFoundError({ pluginId: "p", project: "x" });
		expect(err._tag).toBe("PluginSourceNotFoundError");
	});

	test("UnknownPluginError carries plugin id", () => {
		const err = new UnknownPluginError({ pluginId: "nope" });
		expect(err._tag).toBe("UnknownPluginError");
	});

	test("SubAgentNotSupportedError carries plugin id", () => {
		const err = new SubAgentNotSupportedError({ pluginId: "p" });
		expect(err._tag).toBe("SubAgentNotSupportedError");
	});

	test("SettingsWriteError carries path and cause", () => {
		const cause = new Error("EACCES");
		const err = new SettingsWriteError({ path: "/tmp/s.json", cause });
		expect(err._tag).toBe("SettingsWriteError");
		expect(err.path).toBe("/tmp/s.json");
		expect(err.cause).toBe(cause);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/server/src/services/errors.test.ts`

Expected: FAIL with module resolution error ("Cannot find module './errors.ts'").

- [ ] **Step 3: Create errors.ts**

Create `packages/server/src/services/errors.ts`:

```ts
import { Data } from "effect";

export class InvalidSessionIdError extends Data.TaggedError("InvalidSessionIdError")<{
	readonly value: string;
}> {}

export class ProjectNotFoundError extends Data.TaggedError("ProjectNotFoundError")<{
	readonly encodedPath: string;
}> {}

export class PluginSourceNotFoundError extends Data.TaggedError("PluginSourceNotFoundError")<{
	readonly pluginId: string;
	readonly project: string;
}> {}

export class UnknownPluginError extends Data.TaggedError("UnknownPluginError")<{
	readonly pluginId: string;
}> {}

export class SubAgentNotSupportedError extends Data.TaggedError("SubAgentNotSupportedError")<{
	readonly pluginId: string;
}> {}

export class SettingsWriteError extends Data.TaggedError("SettingsWriteError")<{
	readonly path: string;
	readonly cause: unknown;
}> {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/server/src/services/errors.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Run full verification**

Run: `bun run check && bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/errors.ts packages/server/src/services/errors.test.ts
git commit -m "feat(server): add tagged domain error types for Effect migration"
```

---

## Task 2: Convert settings.ts to Effect (I/O primitives)

**Goal:** Replace `node:fs/promises` with `@effect/platform` `FileSystem` service. `loadSettings` and `saveSettings` return Effects. Keep `getDefaultSettings` pure.

**Files:**
- Modify: `packages/server/src/services/settings.ts`
- Modify: `packages/server/src/services/settings.test.ts`

- [ ] **Step 1: Update the test file to the new Effect-based contract**

Replace `packages/server/src/services/settings.test.ts` contents with:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import type { PluginSettings } from "./settings.ts";
import { getDefaultSettings, loadSettings, saveSettings } from "./settings.ts";

const testDir = join(tmpdir(), `klovi-settings-test-${Date.now()}`);

function settingsPath(): string {
	return join(testDir, "settings.json");
}

function run<A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

describe("settings", () => {
	afterEach(async () => {
		if (await Bun.file(testDir).exists()) {
			await rm(testDir, { recursive: true });
		}
	});

	test("getDefaultSettings returns all plugins enabled with null dataDirs", () => {
		const settings = getDefaultSettings();
		expect(settings.version).toBe(1);
		expect(settings.plugins["claude-code"]).toEqual({ enabled: true, dataDir: null });
		expect(settings.plugins["codex-cli"]).toEqual({ enabled: true, dataDir: null });
		expect(settings.plugins["opencode"]).toEqual({ enabled: true, dataDir: null });
	});

	test("loadSettings returns defaults when file does not exist", async () => {
		const settings = await run(loadSettings(join(testDir, "nonexistent", "settings.json")));
		expect(settings).toEqual(getDefaultSettings());
	});

	test("saveSettings writes and loadSettings reads back", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		const settings: PluginSettings = {
			version: 1,
			plugins: {
				"claude-code": { enabled: false, dataDir: "/custom/path" },
				"codex-cli": { enabled: true, dataDir: null },
				opencode: { enabled: true, dataDir: null },
			},
		};
		await run(saveSettings(path, settings));
		const loaded = await run(loadSettings(path));
		expect(loaded).toEqual(settings);
	});

	test("saveSettings creates parent directories", async () => {
		const deep = join(testDir, "a", "b", "settings.json");
		await run(saveSettings(deep, getDefaultSettings()));
		expect(await Bun.file(deep).exists()).toBe(true);
	});

	test("loadSettings returns defaults for corrupted JSON", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		await Bun.write(path, "not valid json{{{");
		const settings = await run(loadSettings(path));
		expect(settings).toEqual(getDefaultSettings());
	});

	test("getDefaultSettings includes updates with stable channel", () => {
		const settings = getDefaultSettings();
		expect(settings.updates).toEqual({
			channel: "stable",
			checkIntervalHours: 6,
			autoDownload: true,
		});
	});

	test("loadSettings preserves updates field", async () => {
		await mkdir(testDir, { recursive: true });
		const path = settingsPath();
		const settings: PluginSettings = {
			...getDefaultSettings(),
			updates: { channel: "beta", checkIntervalHours: 1, autoDownload: false },
		};
		await run(saveSettings(path, settings));
		const loaded = await run(loadSettings(path));
		expect(loaded.updates).toEqual({ channel: "beta", checkIntervalHours: 1, autoDownload: false });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/server/src/services/settings.test.ts`

Expected: FAIL with type error or runtime error — `loadSettings` still returns `Promise` not `Effect`.

- [ ] **Step 3: Rewrite settings.ts to return Effects**

Replace `packages/server/src/services/settings.ts` contents with:

```ts
import { dirname, join } from "node:path";
import { BUILTIN_KLOVI_PLUGIN_IDS } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { SettingsWriteError } from "./errors.ts";

type UpdateChannel = "stable" | "candidate" | "beta";

type UpdateSettings = {
	channel: UpdateChannel;
	checkIntervalHours: number;
	autoDownload: boolean;
};

type PluginSettings = {
	version: 1;
	plugins: {
		[pluginId: string]: {
			enabled: boolean;
			dataDir: string | null;
		};
	};
	general?:
		| {
				showSecurityWarning?: boolean | undefined;
		  }
		| undefined;
	updates?: UpdateSettings | undefined;
};

function createDefaultPluginStates(): PluginSettings["plugins"] {
	return Object.fromEntries(BUILTIN_KLOVI_PLUGIN_IDS.map((pluginId) => [pluginId, { enabled: true, dataDir: null }]));
}

function getDefaultSettings(): PluginSettings {
	return {
		version: 1,
		plugins: createDefaultPluginStates(),
		general: {
			showSecurityWarning: true,
		},
		updates: {
			channel: "stable",
			checkIntervalHours: 6,
			autoDownload: true,
		},
	};
}

function loadSettings(path: string): Effect.Effect<PluginSettings, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const content = yield* fs.readFileString(path).pipe(Effect.catchAll(() => Effect.succeed(null)));
		if (content === null) {
			return getDefaultSettings();
		}
		const parsed = yield* Effect.try({
			try: () => JSON.parse(content) as Record<string, unknown>,
			catch: () => null,
		}).pipe(Effect.catchAll(() => Effect.succeed(null)));
		if (parsed === null || parsed["version"] !== 1 || typeof parsed["plugins"] !== "object") {
			return getDefaultSettings();
		}
		return parsed as unknown as PluginSettings;
	});
}

function saveSettings(
	path: string,
	settings: PluginSettings,
): Effect.Effect<void, SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const dir = dirname(path);
		yield* fs.makeDirectory(dir, { recursive: true }).pipe(
			Effect.mapError((cause) => new SettingsWriteError({ path, cause })),
		);
		const tmpPath = join(dir, `.settings-${Date.now()}.tmp`);
		yield* fs.writeFileString(tmpPath, JSON.stringify(settings, null, 2)).pipe(
			Effect.mapError((cause) => new SettingsWriteError({ path, cause })),
		);
		yield* fs.rename(tmpPath, path).pipe(
			Effect.mapError((cause) => new SettingsWriteError({ path, cause })),
		);
	});
}

function settingsFileExists(path: string): Effect.Effect<boolean, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.exists(path).pipe(Effect.catchAll(() => Effect.succeed(false)));
	});
}

function deleteSettingsFile(path: string): Effect.Effect<void, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(path).pipe(Effect.catchAll(() => Effect.void));
	});
}

export type { PluginSettings, UpdateChannel, UpdateSettings };
export { deleteSettingsFile, getDefaultSettings, loadSettings, saveSettings, settingsFileExists };
```

- [ ] **Step 4: Fix all existing callers to bridge to the new Effect API**

Callers to update (will break compile temporarily until Task 9):

1. `packages/server/src/effect/server-services.ts` — currently uses `Effect.promise(() => loadSettings(settingsPath))`. Change to `yield* loadSettings(settingsPath)` (and add `FileSystem` to the layer's requirements, which is automatic via `R` channel propagation).

Edit `packages/server/src/effect/server-services.ts`, replacing lines 73-74:

```ts
// Before:
const settings = yield* Effect.promise(() => loadSettings(settingsPath));
let registry: PluginRegistry = yield* Effect.promise(() => createRegistry(settings));

// After:
const settings = yield* loadSettings(settingsPath);
let registry: PluginRegistry = yield* Effect.promise(() => createRegistry(settings));
```

And replace lines 76-79 (`refreshRegistry` helper):

```ts
// Before:
async function refreshRegistry(): Promise<void> {
	const freshSettings = await loadSettings(settingsPath);
	registry = await createRegistry(freshSettings);
}

// After:
const refreshRegistry = (): Effect.Effect<void, never, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const freshSettings = yield* loadSettings(settingsPath);
		registry = yield* Effect.promise(() => createRegistry(freshSettings));
	});
```

And update the two callers of `refreshRegistry` in the returned services object (lines 91-95 and 99-103):

```ts
// Before:
updatePluginSetting: async (params) => {
	const result = await updatePluginSetting(settingsPath, params);
	await refreshRegistry();
	return result;
},
...
resetSettings: async () => {
	const result = await resetSettings(settingsPath);
	await refreshRegistry();
	return result;
},

// After:
updatePluginSetting: async (params) => {
	const result = await updatePluginSetting(settingsPath, params);
	await Effect.runPromise(refreshRegistry().pipe(Effect.provide(BunContext.layer)));
	return result;
},
...
resetSettings: async () => {
	const result = await resetSettings(settingsPath);
	await Effect.runPromise(refreshRegistry().pipe(Effect.provide(BunContext.layer)));
	return result;
},
```

Add import at top of `packages/server/src/effect/server-services.ts`:

```ts
import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
```

2. `packages/server/src/services/app-services.ts` — has many `await loadSettings(...)` and `await saveSettings(...)` calls. For now, add a local bridge at the top of the file:

Add these lines near the top of `packages/server/src/services/app-services.ts` (after imports):

```ts
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { loadSettings as loadSettingsEffect, saveSettings as saveSettingsEffect, settingsFileExists, deleteSettingsFile } from "./settings.ts";

function loadSettings(path: string) {
	return Effect.runPromise(loadSettingsEffect(path).pipe(Effect.provide(BunContext.layer)));
}

function saveSettings(path: string, settings: import("./settings.ts").PluginSettings) {
	return Effect.runPromise(saveSettingsEffect(path, settings).pipe(Effect.provide(BunContext.layer)));
}
```

Remove the existing `loadSettings`/`saveSettings` imports from `./settings.ts` and remove the `import { access, rm } from "node:fs/promises";` line. Replace the `access(settingsPath)` call in `isFirstLaunch` with:

```ts
async function isFirstLaunch(settingsPath: string): Promise<{ firstLaunch: boolean }> {
	const exists = await Effect.runPromise(settingsFileExists(settingsPath).pipe(Effect.provide(BunContext.layer)));
	return { firstLaunch: !exists };
}
```

Replace the `rm(settingsPath)` call in `resetSettings` with:

```ts
async function resetSettings(settingsPath: string): Promise<{ ok: boolean }> {
	await Effect.runPromise(deleteSettingsFile(settingsPath).pipe(Effect.provide(BunContext.layer)));
	return { ok: true };
}
```

- [ ] **Step 5: Run settings tests**

Run: `bun test packages/server/src/services/settings.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 6: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services/settings.ts packages/server/src/services/settings.test.ts packages/server/src/services/app-services.ts packages/server/src/effect/server-services.ts
git commit -m "refactor(server): convert settings I/O to Effect with FileSystem service"
```

---

## Task 3: Convert stats.ts to Effect

**Goal:** Aggregation functions become Effects. Session loading runs with unbounded concurrency via `Effect.forEach`. Boundary functions (`runPluginEffect`/`runRegistryEffect`) no longer used inside `stats.ts`.

**Files:**
- Modify: `packages/server/src/services/stats.ts`

- [ ] **Step 1: Rewrite stats.ts to return Effects**

Replace `packages/server/src/services/stats.ts` contents with:

```ts
import type {
	DashboardStats,
	ModelTokenUsage,
	SessionSummary,
	TokenUsage,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer, parseSessionId } from "@cookielab.io/klovi-plugin-core";
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import type { MergedProject } from "./plugin-types.ts";
import type { PluginRegistry } from "./registry.ts";

type SessionWithProject = {
	project: MergedProject;
	session: SessionSummary;
};

function emptyStats(projects = 0): DashboardStats {
	return {
		projects: projects,
		sessions: 0,
		messages: 0,
		todaySessions: 0,
		thisWeekSessions: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheCreationTokens: 0,
		toolCalls: 0,
		models: {},
	};
}

function toDateString(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countRecentSessions(sessions: SessionSummary[]): {
	todaySessions: number;
	thisWeekSessions: number;
} {
	const today = toDateString(new Date());
	const now = new Date();
	const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
	const weekAgoStr = toDateString(weekAgo);

	let todaySessions = 0;
	let thisWeekSessions = 0;

	for (const session of sessions) {
		const d = new Date(session.timestamp);
		if (Number.isNaN(d.getTime())) {
			continue;
		}
		const sessionDay = toDateString(d);
		if (sessionDay === today) {
			todaySessions += 1;
		}
		if (sessionDay >= weekAgoStr) {
			thisWeekSessions += 1;
		}
	}

	return { todaySessions: todaySessions, thisWeekSessions: thisWeekSessions };
}

function ensureModelUsage(models: Record<string, ModelTokenUsage>, model: string): ModelTokenUsage {
	const existing = models[model];
	if (existing) {
		return existing;
	}

	const usage: ModelTokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheCreationTokens: 0,
	};
	models[model] = usage;
	return usage;
}

function countVisibleMessages(turns: Turn[]): number {
	return turns.filter((turn) => turn.kind !== "parse_error").length;
}

function collectSessionsWithProjects(
	registry: PluginRegistry,
	stats: DashboardStats,
): Effect.Effect<SessionWithProject[], never, RegistryRequirements> {
	return Effect.gen(function* () {
		const projects = yield* registry.discoverAllProjects().pipe(Effect.catchAll(() => Effect.succeed([])));
		stats.projects = projects.length;

		const sessionsWithProject: SessionWithProject[] = [];
		for (const project of projects) {
			const sessions = yield* registry
				.listAllSessions(project)
				.pipe(Effect.catchAll(() => Effect.succeed([])));
			stats.sessions += sessions.length;
			for (const session of sessions) {
				sessionsWithProject.push({ project: project, session: session });
			}
		}

		return sessionsWithProject;
	});
}

function applyRecentSessionStats(stats: DashboardStats, sessionsWithProject: SessionWithProject[]): void {
	const recent = countRecentSessions(sessionsWithProject.map((item) => item.session));
	stats.todaySessions = recent.todaySessions;
	stats.thisWeekSessions = recent.thisWeekSessions;
}

function loadSessionForStats(
	registry: PluginRegistry,
	project: SessionWithProject["project"],
	session: SessionSummary,
): Effect.Effect<Turn[] | null, never, RegistryRequirements> {
	return Effect.gen(function* () {
		if (!session.pluginId) {
			return null;
		}

		const source = project.sources.find((item) => item.pluginId === session.pluginId);
		if (!source) {
			return null;
		}

		const plugin = registry.getPlugin(session.pluginId);
		const pluginConfig = registry.getPluginConfig(session.pluginId);
		const { rawSessionId } = parseSessionId(session.sessionId);
		const configLayer = makePluginConfigLayer(pluginConfig);
		const loaded = yield* plugin
			.loadSession(source.nativeId, rawSessionId)
			.pipe(Effect.provide(configLayer), Effect.catchAll(() => Effect.succeed(null)));
		return loaded?.turns ?? null;
	});
}

function applyUsageStats(stats: DashboardStats, modelUsage: ModelTokenUsage, usage: TokenUsage): void {
	stats.inputTokens += usage.inputTokens;
	stats.outputTokens += usage.outputTokens;
	stats.cacheReadTokens += usage.cacheReadTokens ?? 0;
	stats.cacheCreationTokens += usage.cacheCreationTokens ?? 0;

	modelUsage.inputTokens += usage.inputTokens;
	modelUsage.outputTokens += usage.outputTokens;
	modelUsage.cacheReadTokens += usage.cacheReadTokens ?? 0;
	modelUsage.cacheCreationTokens += usage.cacheCreationTokens ?? 0;
}

function applyTurnStats(stats: DashboardStats, turns: Turn[], fallbackModel: string): void {
	stats.messages += countVisibleMessages(turns);

	for (const turn of turns) {
		if (turn.kind !== "assistant") {
			continue;
		}

		stats.toolCalls += turn.contentBlocks.filter((block) => block.type === "tool_call").length;
		const modelUsage = ensureModelUsage(stats.models, turn.model || fallbackModel || "unknown");

		if (!turn.usage) {
			continue;
		}
		applyUsageStats(stats, modelUsage, turn.usage);
	}
}

function computeStats(registry: PluginRegistry): Effect.Effect<DashboardStats, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const stats = emptyStats();
		const sessionsWithProject = yield* collectSessionsWithProjects(registry, stats);

		applyRecentSessionStats(stats, sessionsWithProject);

		const turnsPerSession = yield* Effect.forEach(
			sessionsWithProject,
			(item) => loadSessionForStats(registry, item.project, item.session).pipe(Effect.map((turns) => ({ item, turns }))),
			{ concurrency: "unbounded" },
		);

		for (const { item, turns } of turnsPerSession) {
			if (!turns) {
				continue;
			}
			applyTurnStats(stats, turns, item.session.model);
		}

		return stats;
	});
}

export function scanStats(registry: PluginRegistry): Effect.Effect<DashboardStats, never, RegistryRequirements> {
	return computeStats(registry);
}
```

- [ ] **Step 2: Update caller in app-services.ts**

Find this function in `packages/server/src/services/app-services.ts` (around line 51):

```ts
async function getStats(registry: PluginRegistry) {
	const stats = await scanStats(registry);
	return { stats: stats };
}
```

Replace with:

```ts
async function getStats(registry: PluginRegistry) {
	const stats = await runRegistryEffect(scanStats(registry));
	return { stats: stats };
}
```

- [ ] **Step 3: Run tests**

Run: `bun test packages/server/src/services/`

Expected: PASS (no stats.test.ts exists yet; app-services.test.ts still passes via `runRegistryEffect` bridge).

- [ ] **Step 4: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/stats.ts packages/server/src/services/app-services.ts
git commit -m "refactor(server): convert stats aggregation to Effect with parallel session loading"
```

---

## Task 4: Convert auto-discover.ts to Effect

**Goal:** `createRegistry` returns an Effect that yields from `plugin.isDataAvailable` directly.

**Files:**
- Modify: `packages/server/src/services/auto-discover.ts`
- Modify: `packages/server/src/effect/server-services.ts`

- [ ] **Step 1: Rewrite auto-discover.ts**

Replace `packages/server/src/services/auto-discover.ts` contents with:

```ts
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { BUILTIN_PLUGIN_DESCRIPTORS } from "./catalog.ts";
import { PluginRegistry } from "./registry.ts";
import type { PluginSettings } from "./settings.ts";

export function createRegistry(
	settings?: PluginSettings,
): Effect.Effect<PluginRegistry, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const registry = new PluginRegistry();

		for (const { plugin, defaultDir } of BUILTIN_PLUGIN_DESCRIPTORS) {
			const pluginSettings = settings?.plugins[plugin.id];

			// If settings exist and plugin is disabled, skip it
			if (pluginSettings && !pluginSettings.enabled) {
				continue;
			}

			const dataDir = pluginSettings?.dataDir ?? defaultDir;
			const configLayer = makePluginConfigLayer({ dataDir: dataDir });

			const available = yield* plugin.isDataAvailable.pipe(
				Effect.provide(configLayer),
				Effect.catchAll(() => Effect.succeed(false)),
			);

			if (available) {
				registry.register(plugin, { dataDir: dataDir });
			}
		}

		return registry;
	});
}
```

- [ ] **Step 2: Update caller in server-services.ts**

In `packages/server/src/effect/server-services.ts`, replace line 74:

```ts
// Before:
let registry: PluginRegistry = yield* Effect.promise(() => createRegistry(settings));

// After:
let registry: PluginRegistry = yield* createRegistry(settings);
```

And the `refreshRegistry` helper (previously updated in Task 2):

```ts
// Before:
const refreshRegistry = (): Effect.Effect<void, never, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const freshSettings = yield* loadSettings(settingsPath);
		registry = yield* Effect.promise(() => createRegistry(freshSettings));
	});

// After:
const refreshRegistry = (): Effect.Effect<void, never, RegistryRequirements> =>
	Effect.gen(function* () {
		const freshSettings = yield* loadSettings(settingsPath);
		registry = yield* createRegistry(freshSettings);
	});
```

Add import at top:

```ts
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
```

The `BunContext.layer` alone does NOT provide `SqliteClientTag`. We need to also provide the `BunSqliteLayer`. Update the `refreshRegistry` callsites:

```ts
// Before:
updatePluginSetting: async (params) => {
	const result = await updatePluginSetting(settingsPath, params);
	await Effect.runPromise(refreshRegistry().pipe(Effect.provide(BunContext.layer)));
	return result;
},

// After:
updatePluginSetting: async (params) => {
	const result = await updatePluginSetting(settingsPath, params);
	await Effect.runPromise(refreshRegistry().pipe(Effect.provide(BunPluginLayer)));
	return result;
},
```

Do the same replacement in the `resetSettings` handler.

Replace the import:

```ts
// Before:
import { BunContext } from "@effect/platform-bun";

// After:
import { BunPluginLayer } from "./platform-bun.ts";
```

- [ ] **Step 3: Update any other callers of createRegistry**

Check for other callers:

Run: `grep -rn "createRegistry" packages/server/src/`

Expected: only `server-services.ts` and `auto-discover.ts` itself.

- [ ] **Step 4: Run tests**

Run: `bun test packages/server/src/effect/server-services.test.ts packages/server/src/services/`

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/auto-discover.ts packages/server/src/effect/server-services.ts
git commit -m "refactor(server): convert createRegistry to Effect"
```

---

## Task 5: Extract sessions-service.ts (getProjects, getSessions, getSession, getSubAgent, searchSessions)

**Goal:** Move session-related RPC handlers from `app-services.ts` into a dedicated module, converting each to return an Effect.

**Files:**
- Create: `packages/server/src/services/sessions-service.ts`
- Modify: `packages/server/src/services/app-services.ts` (re-export from new file)

- [ ] **Step 1: Create sessions-service.ts**

Create `packages/server/src/services/sessions-service.ts`:

```ts
import type { GlobalSessionResult, RegistryRequirements, Session, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import {
	encodeSessionId,
	makePluginConfigLayer,
	parseSessionId,
	sortByIsoDesc,
} from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "./errors.ts";
import type { MergedProject } from "./plugin-types.ts";
import type { PluginRegistry } from "./registry.ts";

type ProjectsResponse = { projects: MergedProject[] };
type SessionsResponse = { sessions: SessionSummary[] };
type SessionResponse = { session: Session };
type SearchResponse = { sessions: GlobalSessionResult[] };

function getProjects(registry: PluginRegistry): Effect.Effect<ProjectsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const projects = yield* registry.discoverAllProjects();
		return { projects: projects };
	});
}

function getSessions(
	registry: PluginRegistry,
	params: { encodedPath: string },
): Effect.Effect<SessionsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const projects = yield* registry.discoverAllProjects();
		const project = projects.find((p) => p.encodedPath === params.encodedPath);
		if (!project) {
			return { sessions: [] as SessionSummary[] };
		}
		const sessions = yield* registry.listAllSessions(project);
		return { sessions: sessions };
	});
}

type GetSessionError = InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError;

function getSession(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<SessionResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const pluginId = parsed.pluginId;
		const rawSessionId = parsed.rawSessionId;

		const projects = yield* registry.discoverAllProjects();
		const project = projects.find((p) => p.encodedPath === params.project);
		if (!project) {
			return yield* Effect.fail(new ProjectNotFoundError({ encodedPath: params.project }));
		}

		const source = project.sources.find((s) => s.pluginId === pluginId);
		if (!source) {
			return yield* Effect.fail(
				new PluginSourceNotFoundError({ pluginId: pluginId, project: params.project }),
			);
		}

		const plugin = registry.getPlugin(pluginId);
		const pluginConfig = registry.getPluginConfig(pluginId);
		const configLayer = makePluginConfigLayer(pluginConfig);

		const sessionDetail = plugin.loadSessionDetail
			? yield* plugin
					.loadSessionDetail(source.nativeId, rawSessionId)
					.pipe(Effect.provide(configLayer), Effect.catchAll(() => Effect.succeed(undefined)))
			: undefined;

		const session =
			sessionDetail?.session ??
			(yield* plugin
				.loadSession(source.nativeId, rawSessionId)
				.pipe(Effect.provide(configLayer), Effect.catchAll(() => Effect.die("loadSession failed"))));

		session.sessionId = encodeSessionId(pluginId, rawSessionId);
		session.pluginId = pluginId;
		session.planSessionId = sessionDetail?.planSessionId
			? encodeSessionId(pluginId, sessionDetail.planSessionId)
			: undefined;
		session.implSessionId = sessionDetail?.implSessionId
			? encodeSessionId(pluginId, sessionDetail.implSessionId)
			: undefined;
		return { session: session };
	});
}

type GetSubAgentError = InvalidSessionIdError | UnknownPluginError | SubAgentNotSupportedError;

function getSubAgent(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; agentId: string },
): Effect.Effect<SessionResponse, GetSubAgentError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const plugin = registry.getPlugin(parsed.pluginId);
		if (!plugin.loadSubAgentSession) {
			return yield* Effect.fail(new SubAgentNotSupportedError({ pluginId: parsed.pluginId }));
		}

		const pluginConfig = registry.getPluginConfig(parsed.pluginId);
		const configLayer = makePluginConfigLayer(pluginConfig);
		const session = yield* plugin
			.loadSubAgentSession({
				sessionId: parsed.rawSessionId,
				project: params.project,
				agentId: params.agentId,
			})
			.pipe(Effect.provide(configLayer));
		return { session: session };
	});
}

function projectNameFromPath(fullPath: string): string {
	const parts = fullPath.split("/").filter(Boolean);
	return parts.slice(-2).join("/");
}

function searchSessions(
	registry: PluginRegistry,
): Effect.Effect<SearchResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const projects = yield* registry.discoverAllProjects();
		const perProject = yield* Effect.forEach(
			projects,
			(project) =>
				registry.listAllSessions(project).pipe(
					Effect.map((sessions) => ({ project, sessions })),
					Effect.catchAll(() => Effect.succeed({ project, sessions: [] as SessionSummary[] })),
				),
			{ concurrency: "unbounded" },
		);

		const allSessions: GlobalSessionResult[] = [];
		for (const { project, sessions } of perProject) {
			const projectName = projectNameFromPath(project.name);
			for (const session of sessions) {
				allSessions.push({
					...session,
					encodedPath: project.encodedPath,
					projectName: projectName,
				});
			}
		}

		sortByIsoDesc(allSessions, (session) => session.timestamp);
		return { sessions: allSessions };
	});
}

export { getProjects, getSession, getSessions, getSubAgent, searchSessions };
```

- [ ] **Step 2: Update app-services.ts to re-export from sessions-service.ts**

In `packages/server/src/services/app-services.ts`, remove the old implementations of `getProjects`, `getSessions`, `getSession`, `getSubAgent`, `searchSessions` (and `projectNameFromPath`), and add bridging adapters that keep the existing Promise-returning exports working:

Remove these functions from `app-services.ts` (lines 56-156):
- `getProjects`
- `getSessions`
- `getSession`
- `getSubAgent`
- `projectNameFromPath`
- `searchSessions`

Replace with:

```ts
import * as sessionsService from "./sessions-service.ts";

async function getProjects(registry: PluginRegistry) {
	return runRegistryEffect(sessionsService.getProjects(registry));
}

async function getSessions(registry: PluginRegistry, params: { encodedPath: string }) {
	return runRegistryEffect(sessionsService.getSessions(registry, params));
}

async function getSession(registry: PluginRegistry, params: { sessionId: string; project: string }) {
	return runRegistryEffect(
		sessionsService.getSession(registry, params).pipe(
			Effect.catchTags({
				InvalidSessionIdError: () => Effect.die(new Error("Invalid sessionId format")),
				ProjectNotFoundError: () => Effect.die(new Error("Project not found")),
				PluginSourceNotFoundError: () => Effect.die(new Error("Plugin source not found")),
			}),
		),
	);
}

async function getSubAgent(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; agentId: string },
) {
	return runRegistryEffect(
		sessionsService.getSubAgent(registry, params).pipe(
			Effect.catchTags({
				InvalidSessionIdError: () => Effect.die(new Error("Invalid sessionId format")),
				UnknownPluginError: (e) => Effect.die(new Error(`Unknown plugin: ${e.pluginId}`)),
				SubAgentNotSupportedError: (e) =>
					Effect.die(new Error(`Sub-agent sessions are not supported by plugin: ${e.pluginId}`)),
			}),
		),
	);
}

async function searchSessions(registry: PluginRegistry) {
	return runRegistryEffect(sessionsService.searchSessions(registry));
}
```

Note: `Effect.die` is used to preserve the existing behavior where these errors throw uncaught. This keeps backwards compatibility with callers that expect `throw new Error(...)`. The final dispatcher (Task 8) will replace these with typed `Effect.fail` handling.

- [ ] **Step 3: Run tests**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/sessions-service.ts packages/server/src/services/app-services.ts
git commit -m "refactor(server): extract sessions handlers into sessions-service.ts as Effects"
```

---

## Task 6: Extract settings-service.ts (settings RPC handlers)

**Goal:** Move plugin/general/update settings RPC handlers from `app-services.ts` into `settings-service.ts` as Effects.

**Files:**
- Create: `packages/server/src/services/settings-service.ts`
- Modify: `packages/server/src/services/app-services.ts`

- [ ] **Step 1: Create settings-service.ts**

Create `packages/server/src/services/settings-service.ts`:

```ts
import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_PLUGIN_ID_SET } from "./catalog.ts";
import { SettingsWriteError, UnknownPluginError } from "./errors.ts";
import type { PluginSettings, UpdateChannel } from "./settings.ts";
import { loadSettings, saveSettings } from "./settings.ts";

type PluginSettingInfo = {
	id: string;
	displayName: string;
	enabled: boolean;
	dataDir: string;
	defaultDataDir: string;
	isCustomDir: boolean;
};

type UpdateSettingsInfo = {
	channel: UpdateChannel;
	checkIntervalHours: number;
	autoDownload: boolean;
};

function buildPluginSettingsResponse(
	settingsPath: string,
): Effect.Effect<{ plugins: PluginSettingInfo[] }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const settings = yield* loadSettings(settingsPath);
		const plugins: PluginSettingInfo[] = BUILTIN_PLUGIN_DESCRIPTORS.map(({ plugin, defaultDir }) => {
			const id = plugin.id;
			const displayName = plugin.displayName;
			const pluginConf = settings.plugins[id] ?? { enabled: true, dataDir: null };
			const defaultDataDir = defaultDir;
			const isCustomDir = pluginConf.dataDir !== null;
			return {
				id: id,
				displayName: displayName,
				enabled: pluginConf.enabled,
				dataDir: pluginConf.dataDir ?? defaultDataDir,
				defaultDataDir: defaultDataDir,
				isCustomDir: isCustomDir,
			};
		});
		return { plugins: plugins };
	});
}

function getPluginSettings(
	settingsPath: string,
): Effect.Effect<{ plugins: PluginSettingInfo[] }, never, FileSystem.FileSystem> {
	return buildPluginSettingsResponse(settingsPath);
}

function getGeneralSettings(
	settingsPath: string,
): Effect.Effect<{ showSecurityWarning: boolean }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const settings = yield* loadSettings(settingsPath);
		return { showSecurityWarning: settings.general?.showSecurityWarning ?? true };
	});
}

function updateGeneralSettings(
	settingsPath: string,
	params: { showSecurityWarning?: boolean },
): Effect.Effect<{ showSecurityWarning: boolean }, SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const settings = yield* loadSettings(settingsPath);
		if (!settings.general) {
			settings.general = {};
		}
		if (params.showSecurityWarning !== undefined) {
			settings.general.showSecurityWarning = params.showSecurityWarning;
		}
		yield* saveSettings(settingsPath, settings);
		return { showSecurityWarning: settings.general.showSecurityWarning ?? true };
	});
}

function updatePluginSetting(
	settingsPath: string,
	params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): Effect.Effect<{ plugins: PluginSettingInfo[] }, UnknownPluginError | SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		if (!BUILTIN_PLUGIN_ID_SET.has(params.pluginId)) {
			return yield* Effect.fail(new UnknownPluginError({ pluginId: params.pluginId }));
		}
		const settings: PluginSettings = yield* loadSettings(settingsPath);
		const existing = settings.plugins[params.pluginId] ?? { enabled: true, dataDir: null };

		if (params.enabled !== undefined) {
			existing.enabled = params.enabled;
		}
		if (params.dataDir !== undefined) {
			existing.dataDir = params.dataDir;
		}

		settings.plugins[params.pluginId] = existing;
		yield* saveSettings(settingsPath, settings);
		return yield* buildPluginSettingsResponse(settingsPath);
	});
}

function getUpdateSettings(
	settingsPath: string,
): Effect.Effect<UpdateSettingsInfo, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const settings = yield* loadSettings(settingsPath);
		return {
			channel: settings.updates?.channel ?? "stable",
			checkIntervalHours: settings.updates?.checkIntervalHours ?? 6,
			autoDownload: settings.updates?.autoDownload ?? true,
		};
	});
}

function updateUpdateSettings(
	settingsPath: string,
	params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
): Effect.Effect<UpdateSettingsInfo, SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const settings = yield* loadSettings(settingsPath);
		if (!settings.updates) {
			settings.updates = { channel: "stable", checkIntervalHours: 6, autoDownload: true };
		}
		if (params.channel !== undefined) {
			settings.updates.channel = params.channel;
		}
		if (params.checkIntervalHours !== undefined) {
			const clamped = Math.max(1, Math.min(24, Math.round(params.checkIntervalHours)));
			settings.updates.checkIntervalHours = clamped;
		}
		if (params.autoDownload !== undefined) {
			settings.updates.autoDownload = params.autoDownload;
		}
		yield* saveSettings(settingsPath, settings);
		return {
			channel: settings.updates.channel,
			checkIntervalHours: settings.updates.checkIntervalHours,
			autoDownload: settings.updates.autoDownload,
		};
	});
}

export type { PluginSettingInfo, UpdateSettingsInfo };
export {
	getGeneralSettings,
	getPluginSettings,
	getUpdateSettings,
	updateGeneralSettings,
	updatePluginSetting,
	updateUpdateSettings,
};
```

- [ ] **Step 2: Update app-services.ts to delegate to settings-service.ts**

In `packages/server/src/services/app-services.ts`:

Remove the old implementations of: `buildPluginSettingsResponse`, `getPluginSettings`, `getGeneralSettings`, `updateGeneralSettings`, `updatePluginSetting`, `getUpdateSettings`, `updateUpdateSettings`.

Remove the imports of `BUILTIN_PLUGIN_DESCRIPTORS`, `BUILTIN_PLUGIN_ID_SET` (no longer needed).
Remove the local type `PluginSettingInfo` and `UpdateSettingsInfo` definitions.

Add:

```ts
import * as settingsServiceEffect from "./settings-service.ts";
import type { PluginSettingInfo, UpdateSettingsInfo } from "./settings-service.ts";

function runSettingsEffect<A, E>(
	effect: Effect.Effect<A, E, import("@effect/platform").FileSystem.FileSystem>,
): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

function getPluginSettings(settingsPath: string): Promise<{ plugins: PluginSettingInfo[] }> {
	return runSettingsEffect(settingsServiceEffect.getPluginSettings(settingsPath));
}

async function getGeneralSettings(settingsPath: string): Promise<{ showSecurityWarning: boolean }> {
	return runSettingsEffect(settingsServiceEffect.getGeneralSettings(settingsPath));
}

async function updateGeneralSettings(
	settingsPath: string,
	params: { showSecurityWarning?: boolean },
): Promise<{ showSecurityWarning: boolean }> {
	return runSettingsEffect(settingsServiceEffect.updateGeneralSettings(settingsPath, params));
}

async function updatePluginSetting(
	settingsPath: string,
	params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): Promise<{ plugins: PluginSettingInfo[] }> {
	return runSettingsEffect(
		settingsServiceEffect.updatePluginSetting(settingsPath, params).pipe(
			Effect.catchTags({
				UnknownPluginError: (e) => Effect.die(new Error(`Unknown plugin: ${e.pluginId}`)),
				SettingsWriteError: (e) => Effect.die(e.cause),
			}),
		),
	);
}

async function getUpdateSettings(settingsPath: string): Promise<UpdateSettingsInfo> {
	return runSettingsEffect(settingsServiceEffect.getUpdateSettings(settingsPath));
}

async function updateUpdateSettings(
	settingsPath: string,
	params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
): Promise<UpdateSettingsInfo> {
	return runSettingsEffect(
		settingsServiceEffect.updateUpdateSettings(settingsPath, params).pipe(
			Effect.catchTag("SettingsWriteError", (e) => Effect.die(e.cause)),
		),
	);
}
```

Also update the `export type` line to re-export from the new location:

```ts
// Before:
export type { PluginSettingInfo, UpdateSettingsInfo, VersionInfo };

// After:
export type { VersionInfo };
export type { PluginSettingInfo, UpdateSettingsInfo } from "./settings-service.ts";
```

- [ ] **Step 3: Run tests**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/settings-service.ts packages/server/src/services/app-services.ts
git commit -m "refactor(server): extract settings handlers into settings-service.ts as Effects"
```

---

## Task 7: Extract onboarding-service.ts + stats-service.ts + final app-services.ts cleanup

**Goal:** Move the remaining handlers (`isFirstLaunch`, `completeOnboarding`, `resetSettings`, `getStats`) into dedicated service modules. Delete `app-services.ts`. Move `setVersion`/`getVersion` into a module-level concern inside `server-services.ts`.

**Files:**
- Create: `packages/server/src/services/onboarding-service.ts`
- Create: `packages/server/src/services/stats-service.ts`
- Create: `packages/server/src/services/version-service.ts`
- Delete: `packages/server/src/services/app-services.ts`
- Modify: `packages/server/src/effect/server-services.ts`
- Modify: `packages/server/src/services/app-services.test.ts`

- [ ] **Step 1: Create onboarding-service.ts**

```ts
import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import type { SettingsWriteError } from "./errors.ts";
import { deleteSettingsFile, getDefaultSettings, saveSettings, settingsFileExists } from "./settings.ts";

function isFirstLaunch(
	settingsPath: string,
): Effect.Effect<{ firstLaunch: boolean }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const exists = yield* settingsFileExists(settingsPath);
		return { firstLaunch: !exists };
	});
}

function completeOnboarding(
	settingsPath: string,
): Effect.Effect<{ ok: boolean }, SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { firstLaunch } = yield* isFirstLaunch(settingsPath);
		if (firstLaunch) {
			yield* saveSettings(settingsPath, getDefaultSettings());
		}
		return { ok: true };
	});
}

function resetSettings(
	settingsPath: string,
): Effect.Effect<{ ok: boolean }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		yield* deleteSettingsFile(settingsPath);
		return { ok: true };
	});
}

export { completeOnboarding, isFirstLaunch, resetSettings };
```

- [ ] **Step 2: Create stats-service.ts**

```ts
import type { DashboardStats, RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import type { PluginRegistry } from "./registry.ts";
import { scanStats } from "./stats.ts";

function getStats(
	registry: PluginRegistry,
): Effect.Effect<{ stats: DashboardStats }, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const stats = yield* scanStats(registry);
		return { stats: stats };
	});
}

export { getStats };
```

- [ ] **Step 3: Create version-service.ts**

```ts
type VersionInfo = {
	version: string;
	commit: string;
};

type VersionState = {
	version: string;
	commit: string;
};

function makeVersionState(version: string, commit: string): VersionState {
	const normalizedVersion = version == null || version === "0.0.0" ? "dev" : version;
	return { version: normalizedVersion, commit: commit ?? "" };
}

function getVersion(state: VersionState): VersionInfo {
	return { version: state.version, commit: state.commit };
}

export type { VersionInfo, VersionState };
export { getVersion, makeVersionState };
```

- [ ] **Step 4: Rewire server-services.ts to use the new services directly**

Replace `packages/server/src/effect/server-services.ts` contents with:

```ts
import type {
	DashboardStats,
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
} from "@cookielab.io/klovi-plugin-core";
import type { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { createRegistry } from "../services/auto-discover.ts";
import type {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "../services/errors.ts";
import {
	completeOnboarding,
	isFirstLaunch,
	resetSettings,
} from "../services/onboarding-service.ts";
import type { MergedProject } from "../services/plugin-types.ts";
import type { PluginRegistry } from "../services/registry.ts";
import {
	getProjects,
	getSession,
	getSessions,
	getSubAgent,
	searchSessions,
} from "../services/sessions-service.ts";
import {
	getGeneralSettings,
	getPluginSettings,
	getUpdateSettings,
	type PluginSettingInfo,
	type UpdateSettingsInfo,
	updateGeneralSettings,
	updatePluginSetting,
	updateUpdateSettings,
} from "../services/settings-service.ts";
import type { UpdateChannel } from "../services/settings.ts";
import { loadSettings } from "../services/settings.ts";
import { getStats } from "../services/stats-service.ts";
import { getVersion, makeVersionState, type VersionInfo } from "../services/version-service.ts";
import { ServerConfig } from "./server-config.ts";

export type KloviServicesShape = {
	readonly acceptRisks: () => Effect.Effect<{ ok: boolean }, SettingsWriteError, FileSystem.FileSystem>;
	readonly getVersion: () => VersionInfo;
	readonly getStats: () => Effect.Effect<{ stats: DashboardStats }, never, RegistryRequirements>;
	readonly getProjects: () => Effect.Effect<{ projects: MergedProject[] }, never, RegistryRequirements>;
	readonly getSessions: (params: {
		encodedPath: string;
	}) => Effect.Effect<{ sessions: SessionSummary[] }, never, RegistryRequirements>;
	readonly getSession: (params: {
		sessionId: string;
		project: string;
	}) => Effect.Effect<
		{ session: Session },
		InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError,
		RegistryRequirements
	>;
	readonly getSubAgent: (params: {
		sessionId: string;
		project: string;
		agentId: string;
	}) => Effect.Effect<
		{ session: Session },
		InvalidSessionIdError | UnknownPluginError | SubAgentNotSupportedError,
		RegistryRequirements
	>;
	readonly searchSessions: () => Effect.Effect<
		{ sessions: GlobalSessionResult[] },
		never,
		RegistryRequirements
	>;
	readonly getPluginSettings: () => Effect.Effect<
		{ plugins: PluginSettingInfo[] },
		never,
		FileSystem.FileSystem
	>;
	readonly updatePluginSetting: (params: {
		pluginId: string;
		enabled?: boolean;
		dataDir?: string | null;
	}) => Effect.Effect<
		{ plugins: PluginSettingInfo[] },
		UnknownPluginError | SettingsWriteError,
		RegistryRequirements
	>;
	readonly getGeneralSettings: () => Effect.Effect<
		{ showSecurityWarning: boolean },
		never,
		FileSystem.FileSystem
	>;
	readonly updateGeneralSettings: (params: {
		showSecurityWarning?: boolean;
	}) => Effect.Effect<{ showSecurityWarning: boolean }, SettingsWriteError, FileSystem.FileSystem>;
	readonly isFirstLaunch: () => Effect.Effect<{ firstLaunch: boolean }, never, FileSystem.FileSystem>;
	readonly resetSettings: () => Effect.Effect<{ ok: boolean }, never, RegistryRequirements>;
	readonly getUpdateSettings: () => Effect.Effect<UpdateSettingsInfo, never, FileSystem.FileSystem>;
	readonly updateUpdateSettings: (params: {
		channel?: UpdateChannel;
		checkIntervalHours?: number;
		autoDownload?: boolean;
	}) => Effect.Effect<UpdateSettingsInfo, SettingsWriteError, FileSystem.FileSystem>;
	readonly getRegistry: () => PluginRegistry;
	readonly settingsPath: string;
};

export class KloviServices extends Context.Tag("@klovi/KloviServices")<KloviServices, KloviServicesShape>() {}

export const KloviServicesLive = Layer.effect(
	KloviServices,
	Effect.gen(function* () {
		const config = yield* ServerConfig;
		const { settingsPath } = config;
		const versionState = makeVersionState(config.version, config.commit);
		const settings = yield* loadSettings(settingsPath);
		let registry: PluginRegistry = yield* createRegistry(settings);

		const refreshRegistry = (): Effect.Effect<void, never, RegistryRequirements> =>
			Effect.gen(function* () {
				const freshSettings = yield* loadSettings(settingsPath);
				registry = yield* createRegistry(freshSettings);
			});

		return {
			acceptRisks: () => completeOnboarding(settingsPath),
			getVersion: () => getVersion(versionState),
			getStats: () => getStats(registry),
			getProjects: () => getProjects(registry),
			getSessions: (params) => getSessions(registry, params),
			getSession: (params) => getSession(registry, params),
			getSubAgent: (params) => getSubAgent(registry, params),
			searchSessions: () => searchSessions(registry),
			getPluginSettings: () => getPluginSettings(settingsPath),
			updatePluginSetting: (params) =>
				Effect.gen(function* () {
					const result = yield* updatePluginSetting(settingsPath, params);
					yield* refreshRegistry();
					return result;
				}),
			getGeneralSettings: () => getGeneralSettings(settingsPath),
			updateGeneralSettings: (params) => updateGeneralSettings(settingsPath, params),
			isFirstLaunch: () => isFirstLaunch(settingsPath),
			resetSettings: () =>
				Effect.gen(function* () {
					const result = yield* resetSettings(settingsPath);
					yield* refreshRegistry();
					return result;
				}),
			getUpdateSettings: () => getUpdateSettings(settingsPath),
			updateUpdateSettings: (params) => updateUpdateSettings(settingsPath, params),
			getRegistry: () => registry,
			settingsPath: settingsPath,
		};
	}),
);
```

- [ ] **Step 5: Delete app-services.ts**

```bash
rm packages/server/src/services/app-services.ts
```

- [ ] **Step 6: Update app-services.test.ts**

Replace `packages/server/src/services/app-services.test.ts` contents:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { getUpdateSettings, updateUpdateSettings } from "./settings-service.ts";
import { getVersion, makeVersionState } from "./version-service.ts";

function run<A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

describe("version-service", () => {
	test("getVersion returns info from state", () => {
		const state = makeVersionState("1.2.3", "abc");
		const result = getVersion(state);
		expect(result.version).toBe("1.2.3");
		expect(result.commit).toBe("abc");
	});

	test("makeVersionState normalizes 0.0.0 to dev", () => {
		const state = makeVersionState("0.0.0", "");
		expect(state.version).toBe("dev");
	});
});

const testDir = join(tmpdir(), `klovi-rpc-test-${Date.now()}`);

describe("update settings handlers", () => {
	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true });
		} catch {}
	});

	test("getUpdateSettings returns defaults when no settings exist", async () => {
		const path = join(testDir, "nonexistent", "settings.json");
		const result = await run(getUpdateSettings(path));
		expect(result.channel).toBe("stable");
		expect(result.checkIntervalHours).toBe(6);
		expect(result.autoDownload).toBe(true);
	});

	test("updateUpdateSettings persists channel change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await run(updateUpdateSettings(path, { channel: "beta" }));
		expect(result.channel).toBe("beta");
		const reloaded = await run(getUpdateSettings(path));
		expect(reloaded.channel).toBe("beta");
	});

	test("updateUpdateSettings persists checkIntervalHours change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await run(updateUpdateSettings(path, { checkIntervalHours: 1 }));
		expect(result.checkIntervalHours).toBe(1);
	});

	test("updateUpdateSettings persists autoDownload change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await run(updateUpdateSettings(path, { autoDownload: false }));
		expect(result.autoDownload).toBe(false);
	});

	test("updateUpdateSettings clamps checkIntervalHours to 1-24", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		expect((await run(updateUpdateSettings(path, { checkIntervalHours: 0 }))).checkIntervalHours).toBe(1);
		expect((await run(updateUpdateSettings(path, { checkIntervalHours: 100 }))).checkIntervalHours).toBe(24);
		expect((await run(updateUpdateSettings(path, { checkIntervalHours: 3.7 }))).checkIntervalHours).toBe(4);
	});
});
```

- [ ] **Step 7: Look for other callers that imported from app-services.ts**

Run: `grep -rn "from.*app-services" packages/ apps/`

Expected results (must all be updated):
- `packages/server/src/effect/server-services.ts` — already updated
- `packages/server/src/services/app-services.test.ts` — already updated

If anything else is found, update imports to point to the new module locations (`sessions-service.ts`, `settings-service.ts`, `onboarding-service.ts`, `stats-service.ts`, `version-service.ts`).

Also grep for places that might set the version:

Run: `grep -rn "setVersion" packages/ apps/`

Expected: should only match the old definition which we're removing, plus any external callers. If the Desktop app or `apps/package` imports `setVersion`, update to pass version/commit through `ServerConfig` instead (they should already do so).

- [ ] **Step 8: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS. If the server-services tests fail because `services.getStats()` etc. now return Effects, that's expected — they will be fixed in Task 9.

If tests fail at this step due to `Effect` return types from `services.method()`, temporarily wrap the calls in the test file:

```ts
// Pattern: change `services.getPluginSettings()` to `Effect.runPromise(services.getPluginSettings().pipe(Effect.provide(BunContext.layer)))` in the service-services test file
```

Apply the same fix to every test assertion that calls a service method.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/services/onboarding-service.ts packages/server/src/services/stats-service.ts packages/server/src/services/version-service.ts packages/server/src/effect/server-services.ts packages/server/src/services/app-services.test.ts packages/server/src/effect/server-services.test.ts
git rm packages/server/src/services/app-services.ts
git commit -m "refactor(server): split app-services into Effect service modules, delete boundary wrappers"
```

---

## Task 8: Rewire http-app.ts to dispatch Effects directly

**Goal:** The HTTP dispatcher yields from handler Effects directly, no `Effect.tryPromise` bridge. Map domain errors to HTTP responses via `Effect.catchTags`.

**Files:**
- Modify: `packages/server/src/effect/http-app.ts`

- [ ] **Step 1: Rewrite http-app.ts**

Replace `packages/server/src/effect/http-app.ts` contents with:

```ts
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "../services/errors.ts";
import { RPCError } from "../rpc-error.ts";
import { KloviServices, type KloviServicesShape } from "./server-services.ts";

/** Methods on KloviServices that are callable via RPC (excludes internal fields). */
type RpcMethodName = {
	[K in keyof KloviServicesShape]: KloviServicesShape[K] extends (...args: never[]) => unknown ? K : never;
}[keyof KloviServicesShape];

/**
 * Fields on KloviServicesShape that are NOT callable RPC methods.
 * IMPORTANT: If you add a non-callable field to KloviServicesShape, add it here too.
 */
const NON_RPC_KEYS: ReadonlySet<string> = new Set(["getRegistry", "settingsPath"]);

function isRpcMethod(method: string, services: KloviServicesShape): method is RpcMethodName {
	return Object.hasOwn(services, method) && !NON_RPC_KEYS.has(method);
}

function mapDomainErrorToStatus(err: unknown): { status: number; message: string } {
	if (err instanceof InvalidSessionIdError) {
		return { status: 400, message: "Invalid sessionId format" };
	}
	if (err instanceof ProjectNotFoundError) {
		return { status: 404, message: "Project not found" };
	}
	if (err instanceof PluginSourceNotFoundError) {
		return { status: 404, message: "Plugin source not found" };
	}
	if (err instanceof UnknownPluginError) {
		return { status: 400, message: `Unknown plugin: ${err.pluginId}` };
	}
	if (err instanceof SubAgentNotSupportedError) {
		return { status: 400, message: `Sub-agent sessions are not supported by plugin: ${err.pluginId}` };
	}
	if (err instanceof SettingsWriteError) {
		return { status: 500, message: "Failed to write settings" };
	}
	if (err instanceof RPCError) {
		return { status: err.status, message: err.message };
	}
	const message = err instanceof Error ? err.message : "Internal server error";
	return { status: 500, message };
}

const rpcHandler = Effect.gen(function* () {
	const services = yield* KloviServices;
	const routeParams = yield* HttpRouter.params;
	const req = yield* HttpServerRequest.HttpServerRequest;

	const method = routeParams["method"];
	if (!method) {
		return HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 });
	}

	if (!isRpcMethod(method, services)) {
		return yield* Effect.fail(new RPCError(404, `Unknown method: ${method}`));
	}

	let params: Record<string, unknown> = {};
	const bodyText = yield* req.text;
	if (bodyText) {
		try {
			params = JSON.parse(bodyText) as Record<string, unknown>;
		} catch {
			return HttpServerResponse.unsafeJson({ error: "Invalid JSON body" }, { status: 400 });
		}
	}

	const handler = services[method] as (args: Record<string, unknown>) => unknown;
	const result = handler(params);
	if (Effect.isEffect(result)) {
		const value = yield* (result as Effect.Effect<unknown, unknown, never>);
		return HttpServerResponse.unsafeJson(value);
	}
	return HttpServerResponse.unsafeJson(result);
}).pipe(
	Effect.catchAll((err) => {
		const { status, message } = mapDomainErrorToStatus(err);
		return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status }));
	}),
);

const emptyMethodHandler = Effect.succeed(
	HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 }),
);

const makeRpcRouter = () =>
	HttpRouter.empty.pipe(
		HttpRouter.post("/api/rpc/", emptyMethodHandler),
		HttpRouter.post("/api/rpc/:method", rpcHandler),
	);

const notFoundHandler = Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 }));

const makeHttpApp = () => makeRpcRouter().pipe(Effect.catchTag("RouteNotFound", () => notFoundHandler));

const makeServeLayer = () => makeHttpApp().pipe(HttpServer.serve());

export { makeHttpApp, makeRpcRouter, makeServeLayer };
```

- [ ] **Step 2: Run tests**

Run: `bun run check && bun run typecheck`

Expected: the `rpcHandler` Effect now has `RegistryRequirements | FileSystem.FileSystem` in its `R` channel (in addition to `KloviServices`). The dispatcher's requirements are wider than before.

This propagates up — the integration tests that use `makeServeLayer()` now require `RegistryRequirements` to be provided. That's fixed in the next task by updating the bootstrap platform layer.

If typecheck fails because `Effect.Effect<unknown, unknown, RegistryRequirements | FileSystem.FileSystem | KloviServices>` cannot satisfy the `HttpRouter.post` route signature (which expects `R = KloviServices` only), that's the expected state — Task 9 fixes it.

Commit and continue to Task 9.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/effect/http-app.ts
git commit -m "refactor(server): dispatch RPC handler Effects directly, map domain errors to HTTP status"
```

---

## Task 9: Provide SQLite layer in server platform bundle

**Goal:** Extend `makeBunServerLayer` and `makeNodeServerLayer` to include the plugin SQLite layer so the HTTP dispatcher can satisfy `RegistryRequirements` (FileSystem + SqliteClientTag) from the platform layer alone.

**Files:**
- Modify: `packages/server/src/effect/platform-bun.ts`
- Modify: `packages/server/src/effect/platform-node.ts`

- [ ] **Step 1: Update platform-bun.ts**

Replace contents of `packages/server/src/effect/platform-bun.ts`:

```ts
import { BunSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { BunContext, BunHttpServer } from "@effect/platform-bun";
import { Layer } from "effect";

export const BunPluginLayer = Layer.merge(BunContext.layer, BunSqliteLayer);

export const makeBunServerLayer = (options: { hostname: string; port: number }) =>
	Layer.mergeAll(BunHttpServer.layer(options), BunContext.layer, BunSqliteLayer);
```

- [ ] **Step 2: Update platform-node.ts**

Replace contents of `packages/server/src/effect/platform-node.ts`:

```ts
import { createServer } from "node:http";
import { NodeSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";

export const NodePluginLayer = Layer.merge(NodeContext.layer, NodeSqliteLayer);

export const makeNodeServerLayer = (options: { host: string; port: number }) =>
	Layer.mergeAll(
		NodeHttpServer.layer(() => createServer(), options),
		NodeContext.layer,
		NodeSqliteLayer,
	);
```

- [ ] **Step 3: Run tests**

Run: `bun run check && bun run typecheck && bun test`

Expected: typecheck should now pass for `http-app.ts` and the full integration. Tests should pass.

If any test in `packages/server/src/services/` fails because it used the old `runRegistryEffect` bridge, update it to use a proper test runtime. Likely failures in `server-services.test.ts` around `Effect.runPromise(... .pipe(Effect.provide(makeTestLayer())))` — the test layer needs to also provide `BunContext.layer + BunSqliteLayer`.

Update `makeTestLayer()` in `packages/server/src/effect/server-services.test.ts`:

```ts
function makeTestLayer() {
	const configLayer = Layer.succeed(ServerConfig, {
		host: "127.0.0.1",
		port: 0,
		settingsPath: settingsPath,
		version: "1.0.0",
		commit: "test",
	});
	return KloviServicesLive.pipe(
		Layer.provide(configLayer),
		Layer.provide(BunPluginLayer),
	);
}
```

Add import:

```ts
import { BunPluginLayer } from "./platform-bun.ts";
```

Update `runWithServices` to resolve service methods through Effect:

```ts
function runWithServices<A>(
	fn: (services: Effect.Effect.Success<typeof KloviServices>) => A | Promise<A>,
): Promise<A> {
	const program = Effect.gen(function* () {
		const services = yield* KloviServices;
		return yield* Effect.promise(() => Promise.resolve(fn(services)));
	});
	return Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));
}
```

For test cases that call Effect-returning service methods, wrap with `Effect.runPromise`:

```ts
// Before:
await services.updatePluginSetting({ pluginId: "claude-code", enabled: false });

// After:
await Effect.runPromise(
	services.updatePluginSetting({ pluginId: "claude-code", enabled: false }).pipe(Effect.provide(BunPluginLayer)),
);
```

Update every such call in the test. Do the same for `services.getPluginSettings()`, `services.resetSettings()`.

- [ ] **Step 4: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/effect/platform-bun.ts packages/server/src/effect/platform-node.ts packages/server/src/effect/server-services.test.ts
git commit -m "feat(server): merge SQLite layer into server platform bundle, remove test boundary bridge"
```

---

## Task 10: Delete plugin-runtime.ts and clean up bootstrap

**Goal:** Remove the `runPluginEffect`/`runRegistryEffect` module entirely. Remove the `setPluginLayer` call in bootstrap.

**Files:**
- Delete: `packages/server/src/effect/plugin-runtime.ts`
- Modify: `packages/server/src/effect/bootstrap.ts`

- [ ] **Step 1: Verify no callers remain**

Run: `grep -rn "plugin-runtime" packages/ apps/ | grep -v node_modules`

Expected: only `packages/server/src/effect/bootstrap.ts` (`setPluginLayer` import).

Run: `grep -rn "runPluginEffect\|runRegistryEffect" packages/ apps/ | grep -v node_modules`

Expected: no results.

If anything remains, fix it before continuing.

- [ ] **Step 2: Delete plugin-runtime.ts**

```bash
rm packages/server/src/effect/plugin-runtime.ts
```

- [ ] **Step 3: Update bootstrap.ts to remove setPluginLayer import and call**

In `packages/server/src/effect/bootstrap.ts`, remove line 5:

```ts
// Remove this line:
import { setPluginLayer } from "./plugin-runtime.ts";
```

And remove lines 62-63 (the node runtime branch's `setPluginLayer` call):

```ts
// Before:
if (rt === "node") {
	const { NodePluginLayer, makeNodeServerLayer } = await import("./platform-node.ts");
	setPluginLayer(NodePluginLayer);
	platformLayer = makeNodeServerLayer({ host: host, port: port });
}

// After:
if (rt === "node") {
	const { makeNodeServerLayer } = await import("./platform-node.ts");
	platformLayer = makeNodeServerLayer({ host: host, port: port });
}
```

- [ ] **Step 4: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/effect/bootstrap.ts
git rm packages/server/src/effect/plugin-runtime.ts
git commit -m "refactor(server): delete runPluginEffect/runRegistryEffect boundary functions"
```

---

## Task 11: Final Phase 1 verification and polish

**Goal:** Confirm all Phase 1 success criteria are met.

- [ ] **Step 1: Verify no Effect.runPromise outside entrypoints**

Run: `grep -rn "Effect.runPromise" packages/server/src/`

Expected results (acceptable locations only):
- `packages/server/src/effect/bootstrap.ts` — entrypoint
- Test files (`*.test.ts`)

If any other file has `Effect.runPromise`, it means there's still a hidden boundary. Investigate and remove.

- [ ] **Step 2: Verify no .catch(() => {}) swallowing in production code**

Run: `grep -rn '\.catch(() => {}\|\.catch(() => \[\])\|\.catch(() => null)' packages/server/src/ | grep -v test`

Expected: no results in non-test production code.

If any remain, convert to explicit `Effect.catchAll` / `Effect.catchTag` handlers.

- [ ] **Step 3: Verify deleted files are gone**

Run: `ls packages/server/src/services/app-services.ts packages/server/src/effect/plugin-runtime.ts 2>&1`

Expected: both paths report "No such file or directory".

- [ ] **Step 4: Run full verification one more time**

Run: `bun run check && bun run typecheck && bun test`

Expected: ALL PASS, no warnings.

- [ ] **Step 5: Quick smoke test of server startup**

Run: `cd apps/desktop && bun run dev`

Manually verify (let the user do this):
- App launches without errors
- Dashboard stats load correctly
- Projects list loads
- Clicking into a session shows the session details
- Settings panel opens and plugin toggles work
- Reset settings works

If smoke test reveals a regression, fix it before committing.

- [ ] **Step 6: Commit (if any polish changes were needed)**

```bash
git add -A
git commit -m "chore(server): final Phase 1 cleanup and verification"
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin t3code/use-effect-js-everywhere
```

---

## Success Criteria (Phase 1)

- [x] `packages/server/src/effect/plugin-runtime.ts` does not exist
- [x] `runPluginEffect` and `runRegistryEffect` are not imported anywhere
- [x] `packages/server/src/services/app-services.ts` does not exist
- [x] Service methods on `KloviServicesShape` return `Effect.Effect<...>`
- [x] `http-app.ts` dispatches handler Effects via `yield*`, no `Effect.tryPromise` bridge
- [x] `mapDomainErrorToStatus` maps at least 5 tagged errors to specific HTTP status codes
- [x] All tests pass (`bun test`)
- [x] Typecheck passes (`bun run typecheck`)
- [x] Biome check passes (`bun run check`)
