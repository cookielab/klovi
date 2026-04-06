# Effect Everywhere — Phase 2a: Desktop Runtime & RPC Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a single `ManagedRuntime` in the desktop main process, extract RPC handlers into Effects, and convert Linux theme detection and polling to Effect fibers scheduled on that runtime.

**Architecture:** A single `ManagedRuntime` is constructed at app startup and disposed on app quit, providing `BunContext` (FileSystem, CommandExecutor), `BunSqliteLayer` (registry requirements), and scoped service refs for version info, settings path, app data dir, and a `Ref<PluginRegistry>` that is refreshed on settings writes (following the Phase 1 `KloviServicesLive` pattern). RPC handlers are defined as Effects in `rpc-handlers.ts` and dispatched to Electrobun's `defineRPC` via `runtime.runPromise(...)` — the single boundary between Electrobun's callback world and the Effect runtime. Linux theme polling uses `Effect.schedule(detectTheme, Schedule.spaced("5 seconds"))` forked onto the runtime's scope. The `updater.ts` module stays as-is for Phase 2a — it is rewritten in Phase 2b.

**Tech Stack:** TypeScript, Bun runtime, `effect` 3.21, `@effect/platform` (FileSystem, CommandExecutor), `@effect/platform-bun`, Electrobun, `bun:test`.

**Spec reference:** `docs/superpowers/specs/2026-04-05-effect-everywhere-design.md` § Phase 2.

---

## File Structure

### Files Created
| Path | Purpose |
|------|---------|
| `apps/desktop/src/bun/services.ts` | `Context.Tag`s for `VersionState`, `SettingsPathRef`, `AppDataDirRef`, `PlatformInfo`, `RegistryRef` |
| `apps/desktop/src/bun/runtime.ts` | `makeDesktopRuntime` + `bridgeHandler` |
| `apps/desktop/src/bun/rpc-handlers.ts` | RPC handler Effects extracted from `index.ts` |
| `apps/desktop/src/bun/theme-polling.ts` | Linux theme polling as a scheduled Effect fiber |

### Files Modified
| Path | Change |
|------|--------|
| `apps/desktop/src/bun/linux-runtime.ts` | `detectLinuxSystemTheme` returns `Effect<SystemTheme \| null, never, CommandExecutor>` |
| `apps/desktop/src/bun/linux-runtime.test.ts` | Tests run the Effect via `Effect.runPromise` with `BunContext.layer` |
| `apps/desktop/src/bun/index.ts` | Wires up the `ManagedRuntime`; all RPC handlers dispatch via `bridgeHandler(runtime, ...)` |
| `apps/desktop/src/bun/updater.ts` | `getSettings` promoted to public; new `updateSettings` public method |

### Files Unchanged (Phase 2b target)
| Path | Reason |
|------|--------|
| `apps/desktop/src/bun/updater.ts` internals | Full Effect rewrite deferred to Phase 2b; Phase 2a only exposes existing methods publicly |
| `apps/desktop/src/bun/updater.test.ts` | Tests stay aligned with `updater.ts` |

---

## Key Types and Conventions

### Context Service Tags (services.ts)

```ts
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context, Ref } from "effect";

export class VersionState extends Context.Tag("@klovi/desktop/VersionState")<
	VersionState,
	{ readonly info: VersionInfo }
>() {}

export class SettingsPathRef extends Context.Tag("@klovi/desktop/SettingsPathRef")<
	SettingsPathRef,
	{ readonly path: string }
>() {}

export class AppDataDirRef extends Context.Tag("@klovi/desktop/AppDataDirRef")<
	AppDataDirRef,
	{ readonly path: string }
>() {}

export class PlatformInfo extends Context.Tag("@klovi/desktop/PlatformInfo")<
	PlatformInfo,
	{ readonly isLinux: boolean }
>() {}

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<
	RegistryRef,
	Ref.Ref<PluginRegistry>
>() {}

export type DesktopServices = VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo | RegistryRef;
```

### Registry Lifetime

A single `Ref<PluginRegistry>` is constructed at runtime startup by loading settings and calling `createRegistry(...)`. RPC read handlers (`getStats`, `getProjects`, etc.) `yield*` the current value. Write handlers (`updatePluginSetting`, `resetSettings`) call a `refreshRegistry` helper that reloads settings, rebuilds the registry, and writes it back to the `Ref`. This mirrors the `KloviServicesLive` pattern established in Phase 1 — the registry is a long-lived runtime singleton, not a per-call recomputation.

### RPC Handler Convention

Each handler is either an Effect (zero-arg handlers) or a factory function taking params and returning an Effect:

```ts
// zero-arg
export const isFirstLaunchHandler = Effect.gen(function* () { ... });

// parameterised
export const getSessionsHandler = (params: { encodedPath: string }) =>
	Effect.gen(function* () { ... });
```

The Electrobun boundary calls `bridgeHandler(runtime, handler)` or `bridgeHandler(runtime, handlerFactory(params))`. `bridgeHandler` is simply a typed wrapper around `runtime.runPromise`.

---

## Task 1: Create Context service tags

**Files:**
- Create: `apps/desktop/src/bun/services.ts`

- [ ] **Step 1: Write services.ts**

Create `apps/desktop/src/bun/services.ts`:

```ts
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context, type Ref } from "effect";

export class VersionState extends Context.Tag("@klovi/desktop/VersionState")<
	VersionState,
	{ readonly info: VersionInfo }
>() {}

export class SettingsPathRef extends Context.Tag("@klovi/desktop/SettingsPathRef")<
	SettingsPathRef,
	{ readonly path: string }
>() {}

export class AppDataDirRef extends Context.Tag("@klovi/desktop/AppDataDirRef")<
	AppDataDirRef,
	{ readonly path: string }
>() {}

export class PlatformInfo extends Context.Tag("@klovi/desktop/PlatformInfo")<
	PlatformInfo,
	{ readonly isLinux: boolean }
>() {}

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<
	RegistryRef,
	Ref.Ref<PluginRegistry>
>() {}

export type DesktopServices = VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo | RegistryRef;
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`

Expected: no new errors beyond the 12 pre-existing baseline errors (9 platform record errors in `index.ts:101`, 3 in `scripts/plugin-runtime-node-smoke.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/bun/services.ts
git commit -m "feat(desktop): add Context service tags for desktop main process runtime"
```

---

## Task 2: Create DesktopRuntime layer and bridgeHandler

**Files:**
- Create: `apps/desktop/src/bun/runtime.ts`

- [ ] **Step 1: Write runtime.ts**

Create `apps/desktop/src/bun/runtime.ts`:

```ts
import { BunPluginLayer } from "@cookielab.io/klovi-server/effect/platform-bun";
import { createRegistry } from "@cookielab.io/klovi-server/services/auto-discover";
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import { loadSettings } from "@cookielab.io/klovi-server/services/settings";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import type { Effect } from "effect";
import { Layer, ManagedRuntime, Ref } from "effect";
import {
	AppDataDirRef,
	type DesktopServices,
	PlatformInfo,
	RegistryRef,
	SettingsPathRef,
	VersionState,
} from "./services.ts";

export type DesktopRuntimeConfig = {
	versionInfo: VersionInfo;
	settingsPath: string;
	appDataDir: string;
	isLinux: boolean;
};

/** Bootstrap the initial registry from settings on disk, wrap in a Ref, expose as RegistryRef. */
const registryLayer = (settingsPath: string): Layer.Layer<RegistryRef, never, never> =>
	Layer.scoped(
		RegistryRef,
		loadSettings(settingsPath).pipe(
			// biome-ignore lint/suspicious/noExplicitAny: effect chain interop
			(eff) => eff as any,
		),
	).pipe(
		Layer.provide(BunPluginLayer),
		// Dummy — real construction is below. Keep this block for layout clarity only.
	) as never;

/**
 * Build the registry Ref as an Effect so Layer.effect can construct it with
 * access to BunPluginLayer (FileSystem + SqliteClient).
 */
const makeRegistryRef = (
	settingsPath: string,
): Effect.Effect<Ref.Ref<PluginRegistry>, never, Layer.Layer.Success<typeof BunPluginLayer>> =>
	loadSettings(settingsPath).pipe(
		(eff) => eff.pipe((e) => e),
		// chain createRegistry and Ref.make
	) as never; // placeholder — real impl below

// Real implementation (replaces the two placeholder definitions above):
export const makeDesktopRuntimeLayer = (config: DesktopRuntimeConfig) => {
	const refsLayer = Layer.mergeAll(
		Layer.succeed(VersionState, { info: config.versionInfo }),
		Layer.succeed(SettingsPathRef, { path: config.settingsPath }),
		Layer.succeed(AppDataDirRef, { path: config.appDataDir }),
		Layer.succeed(PlatformInfo, { isLinux: config.isLinux }),
	);

	const registryRefLayer = Layer.effect(
		RegistryRef,
		loadSettings(config.settingsPath).pipe(
			(eff) => eff,
			// Effect<Settings, ..., FileSystem>
		) as never,
	);

	// NOTE: see Step 2 — the above is prose. The real code is in Step 2.
	return Layer.mergeAll(BunPluginLayer, refsLayer);
};
```

**The code above is intentionally incomplete to show the intent.** Replace the entire file contents with the clean implementation in Step 2.

- [ ] **Step 2: Replace runtime.ts with the clean implementation**

Overwrite `apps/desktop/src/bun/runtime.ts` with this complete implementation:

```ts
import { BunPluginLayer } from "@cookielab.io/klovi-server/effect/platform-bun";
import { createRegistry } from "@cookielab.io/klovi-server/services/auto-discover";
import { loadSettings } from "@cookielab.io/klovi-server/services/settings";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Layer, ManagedRuntime, Ref } from "effect";
import {
	AppDataDirRef,
	type DesktopServices,
	PlatformInfo,
	RegistryRef,
	SettingsPathRef,
	VersionState,
} from "./services.ts";

export type DesktopRuntimeConfig = {
	versionInfo: VersionInfo;
	settingsPath: string;
	appDataDir: string;
	isLinux: boolean;
};

const makeRefsLayer = (config: DesktopRuntimeConfig): Layer.Layer<
	VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo,
	never,
	never
> =>
	Layer.mergeAll(
		Layer.succeed(VersionState, { info: config.versionInfo }),
		Layer.succeed(SettingsPathRef, { path: config.settingsPath }),
		Layer.succeed(AppDataDirRef, { path: config.appDataDir }),
		Layer.succeed(PlatformInfo, { isLinux: config.isLinux }),
	);

const makeRegistryRefLayer = (settingsPath: string) =>
	Layer.effect(
		RegistryRef,
		Effect.gen(function* () {
			const settings = yield* loadSettings(settingsPath);
			const registry = yield* createRegistry(settings);
			return yield* Ref.make(registry);
		}),
	);

export const makeDesktopRuntimeLayer = (config: DesktopRuntimeConfig) => {
	const refs = makeRefsLayer(config);
	const registryRef = makeRegistryRefLayer(config.settingsPath).pipe(Layer.provide(BunPluginLayer));
	return Layer.mergeAll(BunPluginLayer, refs, registryRef);
};

export type DesktopRuntime = ManagedRuntime.ManagedRuntime<
	DesktopServices | Layer.Layer.Success<typeof BunPluginLayer>,
	never
>;

export const makeDesktopRuntime = (config: DesktopRuntimeConfig): DesktopRuntime =>
	ManagedRuntime.make(makeDesktopRuntimeLayer(config)) as DesktopRuntime;

/**
 * Refresh the registry Ref from current settings on disk. Called by write
 * handlers (updatePluginSetting, resetSettings) after the write succeeds.
 */
export const refreshRegistry = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const registryRef = yield* RegistryRef;
	const settings = yield* loadSettings(path);
	const registry = yield* createRegistry(settings);
	yield* Ref.set(registryRef, registry);
});

/**
 * Bridge an Effect (with requirements drawn from the runtime) into an
 * Electrobun-compatible Promise handler.
 */
export const bridgeHandler = <A, E>(
	runtime: DesktopRuntime,
	effect: Effect.Effect<A, E, DesktopServices | Layer.Layer.Success<typeof BunPluginLayer>>,
): Promise<A> => runtime.runPromise(effect);
```

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck`

Expected: no new errors beyond baseline.

If `Layer.Layer.Success<typeof BunPluginLayer>` fails to resolve, the fallback is to spell out the type explicitly as `FileSystem.FileSystem | SqliteClient`. Import `FileSystem` from `@effect/platform` and `SqliteClient` from `@effect/sql-sqlite-bun` (or wherever `BunSqliteLayer` exports it) and rewrite the type union. Inspect `packages/server/src/effect/platform-bun.ts` and the `@cookielab.io/klovi-plugin-opencode` exports to determine the correct tag.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/bun/runtime.ts
git commit -m "feat(desktop): add DesktopRuntime with RegistryRef, refreshRegistry, bridgeHandler"
```

---

## Task 3: Convert `detectLinuxSystemTheme` to return an Effect

**Files:**
- Modify: `apps/desktop/src/bun/linux-runtime.ts`
- Modify: `apps/desktop/src/bun/linux-runtime.test.ts`

- [ ] **Step 1: Replace linux-runtime.ts**

Replace the contents of `apps/desktop/src/bun/linux-runtime.ts`:

```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Command, CommandExecutor } from "@effect/platform";
import { Effect } from "effect";

type BrowserRenderer = "native" | "cef";
type SystemTheme = "dark" | "light";

const DARK_SUFFIX_RE = /-dark/iu;
const DARK_VARIANT_RE = /:dark/iu;
const DARK_RE = /dark/iu;

type DesktopRuntimePaths = {
	userData: string;
	userCache: string;
	userLogs: string;
};

function resolveLinuxRenderer(
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): BrowserRenderer | undefined {
	if (platform !== "linux") {
		return;
	}

	return env["KLOVI_LINUX_RENDERER"] === "cef" ? "cef" : "native";
}

function getDesktopRuntimeDirs(paths: DesktopRuntimePaths): string[] {
	const cefDir = join(paths.userCache, "CEF");
	const partitionsDir = join(cefDir, "Partitions");

	return [paths.userData, paths.userCache, paths.userLogs, cefDir, partitionsDir, join(partitionsDir, "default")];
}

function ensureDesktopRuntimeDirs(paths: DesktopRuntimePaths): void {
	for (const dir of getDesktopRuntimeDirs(paths)) {
		mkdirSync(dir, { recursive: true });
	}
}

const runGsettings = (
	key: string,
): Effect.Effect<string | null, never, CommandExecutor.CommandExecutor> =>
	Effect.gen(function* () {
		const executor = yield* CommandExecutor.CommandExecutor;
		const command = Command.make("gsettings", "get", "org.gnome.desktop.interface", key);
		return yield* executor.string(command).pipe(
			Effect.map((out) => out.trim()),
			Effect.catchAll(() => Effect.succeed<string | null>(null)),
		);
	});

const detectLinuxSystemTheme = (
	platform: NodeJS.Platform = process.platform,
	env: Record<string, string | undefined> = Bun.env,
): Effect.Effect<SystemTheme | null, never, CommandExecutor.CommandExecutor> =>
	Effect.gen(function* () {
		if (platform !== "linux") {
			return null;
		}

		// 1. GNOME 42+ color-scheme setting
		const colorScheme = yield* runGsettings("color-scheme");
		if (colorScheme !== null) {
			if (colorScheme.includes("prefer-dark")) {
				return "dark";
			}
			if (colorScheme.includes("prefer-light") || colorScheme.includes("default")) {
				return "light";
			}
		}

		// 2. GTK_THEME environment variable
		const gtkThemeEnv = env["GTK_THEME"];
		if (gtkThemeEnv) {
			if (DARK_SUFFIX_RE.test(gtkThemeEnv) || DARK_VARIANT_RE.test(gtkThemeEnv)) {
				return "dark";
			}
			return "light";
		}

		// 3. GNOME gtk-theme setting
		const gtkTheme = yield* runGsettings("gtk-theme");
		if (gtkTheme !== null) {
			if (DARK_RE.test(gtkTheme)) {
				return "dark";
			}
			return "light";
		}

		return null;
	});

export type { BrowserRenderer, SystemTheme };
export { detectLinuxSystemTheme, ensureDesktopRuntimeDirs, getDesktopRuntimeDirs, resolveLinuxRenderer };
```

- [ ] **Step 2: Update linux-runtime.test.ts**

Replace `apps/desktop/src/bun/linux-runtime.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import {
	detectLinuxSystemTheme,
	ensureDesktopRuntimeDirs,
	getDesktopRuntimeDirs,
	resolveLinuxRenderer,
} from "./linux-runtime.ts";

const runDetect = (platform: NodeJS.Platform, env: Record<string, string | undefined>) =>
	Effect.runPromise(detectLinuxSystemTheme(platform, env).pipe(Effect.provide(BunContext.layer)));

describe("resolveLinuxRenderer", () => {
	test("defaults to native on Linux", () => {
		expect(resolveLinuxRenderer("linux", {})).toBe("native");
	});

	test("allows CEF override only on Linux", () => {
		expect(resolveLinuxRenderer("linux", { KLOVI_LINUX_RENDERER: "cef" })).toBe("cef");
		expect(resolveLinuxRenderer("darwin", { KLOVI_LINUX_RENDERER: "cef" })).toBeUndefined();
	});
});

describe("detectLinuxSystemTheme", () => {
	test("returns null on non-Linux platforms", async () => {
		expect(await runDetect("darwin", {})).toBeNull();
		expect(await runDetect("win32", {})).toBeNull();
	});

	test("detects dark from GTK_THEME with -dark suffix", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita-dark" })).toBe("dark");
	});

	test("detects dark from GTK_THEME with :dark variant", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita:dark" })).toBe("dark");
	});

	test("detects light from GTK_THEME without dark", async () => {
		expect(await runDetect("linux", { GTK_THEME: "Adwaita" })).toBe("light");
	});
});

describe("desktop runtime directories", () => {
	test("includes user and CEF runtime directories", () => {
		const dirs = getDesktopRuntimeDirs({
			userData: "/tmp/klovi/data",
			userCache: "/tmp/klovi/cache",
			userLogs: "/tmp/klovi/logs",
		});

		expect(dirs).toEqual([
			"/tmp/klovi/data",
			"/tmp/klovi/cache",
			"/tmp/klovi/logs",
			"/tmp/klovi/cache/CEF",
			"/tmp/klovi/cache/CEF/Partitions",
			"/tmp/klovi/cache/CEF/Partitions/default",
		]);
	});

	test("creates all runtime directories", () => {
		const root = mkdtempSync(join(tmpdir(), "klovi-runtime-"));
		const paths = {
			userData: join(root, "data"),
			userCache: join(root, "cache"),
			userLogs: join(root, "logs"),
		};

		ensureDesktopRuntimeDirs(paths);

		for (const dir of getDesktopRuntimeDirs(paths)) {
			expect(existsSync(dir)).toBe(true);
		}
	});
});
```

- [ ] **Step 3: Run linux-runtime tests**

Run: `bun test apps/desktop/src/bun/linux-runtime.test.ts`

Expected: all tests pass. The GTK_THEME fallback path does not spawn any command, so it exercises the Effect wiring without needing a real `gsettings` binary. The "returns null on non-Linux platforms" test exits early before any command.

If the `color-scheme` path still runs on CI (where gsettings is absent), `runGsettings` catches the spawn failure and returns `null`, falling through to the next check.

- [ ] **Step 4: Run full typecheck**

Run: `bun run typecheck`

Expected: new errors may appear in `apps/desktop/src/bun/index.ts` where `detectLinuxSystemTheme` is called as a Promise (line ~220 `getSystemTheme` handler and line ~308 theme polling `setInterval`). These are expected and will be fixed in Task 7. Note the error locations.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/bun/linux-runtime.ts apps/desktop/src/bun/linux-runtime.test.ts
git commit -m "refactor(desktop): convert detectLinuxSystemTheme to Effect using CommandExecutor"
```

---

## Task 4: Create theme-polling.ts scheduled Effect fiber

**Files:**
- Create: `apps/desktop/src/bun/theme-polling.ts`

- [ ] **Step 1: Write theme-polling.ts**

Create `apps/desktop/src/bun/theme-polling.ts`:

```ts
import type { CommandExecutor } from "@effect/platform";
import { Effect, Ref, Schedule } from "effect";
import { detectLinuxSystemTheme, type SystemTheme } from "./linux-runtime.ts";

export type ThemeChangeCallback = (theme: SystemTheme) => void;

/**
 * Poll the Linux system theme every 5 seconds; invoke `onChange` only when the
 * detected theme differs from the previously emitted value.
 *
 * Returns an Effect that, when forked, runs until interrupted. The caller is
 * responsible for scoping the fiber lifetime (e.g. via ManagedRuntime disposal).
 */
export const makeThemePollingFiber = (
	onChange: ThemeChangeCallback,
): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
	Effect.gen(function* () {
		const lastTheme = yield* Ref.make<SystemTheme | null>(null);

		const tick = Effect.gen(function* () {
			const theme = yield* detectLinuxSystemTheme();
			if (theme === null) {
				return;
			}
			const previous = yield* Ref.get(lastTheme);
			if (theme !== previous) {
				yield* Ref.set(lastTheme, theme);
				yield* Effect.sync(() => {
					onChange(theme);
				});
			}
		});

		yield* Effect.schedule(tick, Schedule.spaced("5 seconds"));
	});
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`

Expected: no new errors beyond baseline + the expected `index.ts` errors from Task 3.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/bun/theme-polling.ts
git commit -m "feat(desktop): add Effect-based Linux theme polling fiber"
```

---

## Task 5: Extract RPC handlers into rpc-handlers.ts

**Files:**
- Create: `apps/desktop/src/bun/rpc-handlers.ts`

- [ ] **Step 1: Write rpc-handlers.ts**

Create `apps/desktop/src/bun/rpc-handlers.ts`:

```ts
import {
	completeOnboarding as completeOnboardingEffect,
	isFirstLaunch as isFirstLaunchEffect,
	resetSettings as resetSettingsEffect,
} from "@cookielab.io/klovi-server/services/onboarding-service";
import {
	getProjects as getProjectsEffect,
	getSession as getSessionEffect,
	getSessions as getSessionsEffect,
	getSubAgent as getSubAgentEffect,
	searchSessions as searchSessionsEffect,
} from "@cookielab.io/klovi-server/services/sessions-service";
import {
	getGeneralSettings as getGeneralSettingsEffect,
	getPluginSettings as getPluginSettingsEffect,
	updateGeneralSettings as updateGeneralSettingsEffect,
	updatePluginSetting as updatePluginSettingEffect,
} from "@cookielab.io/klovi-server/services/settings-service";
import { getStats as getStatsEffect } from "@cookielab.io/klovi-server/services/stats-service";
import { getVersion } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Ref } from "effect";
import { refreshRegistry } from "./runtime.ts";
import { RegistryRef, SettingsPathRef, VersionState } from "./services.ts";

// ---------- Onboarding / misc ----------

export const acceptRisksHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	yield* completeOnboardingEffect(path);
	return { ok: true as const };
});

export const isFirstLaunchHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* isFirstLaunchEffect(path);
});

export const getVersionHandler = Effect.gen(function* () {
	const { info } = yield* VersionState;
	return getVersion({ info: info });
});

// ---------- Registry-backed reads ----------

const currentRegistry = Effect.gen(function* () {
	const ref = yield* RegistryRef;
	return yield* Ref.get(ref);
});

export const getStatsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* getStatsEffect(registry);
});

export const getProjectsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* getProjectsEffect(registry);
});

export const getSessionsHandler = (params: { encodedPath: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionsEffect(registry, params);
	});

export const getSessionHandler = (params: { sessionId: string; project: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionEffect(registry, params);
	});

export const getSubAgentHandler = (params: { sessionId: string; project: string; agentId: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSubAgentEffect(registry, params);
	});

export const searchSessionsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* searchSessionsEffect(registry);
});

// ---------- Settings ----------

export const getPluginSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getPluginSettingsEffect(path);
});

export const updatePluginSettingHandler = (params: {
	pluginId: string;
	enabled?: boolean;
	dataDir?: string | null;
}) =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		const result = yield* updatePluginSettingEffect(path, params);
		yield* refreshRegistry;
		return result;
	});

export const getGeneralSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getGeneralSettingsEffect(path);
});

export const updateGeneralSettingsHandler = (params: { showSecurityWarning?: boolean }) =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		return yield* updateGeneralSettingsEffect(path, params);
	});

export const resetSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const result = yield* resetSettingsEffect(path);
	yield* refreshRegistry;
	return result;
});
```

- [ ] **Step 2: Verify `getVersion` signature**

Read `packages/server/src/services/version-service.ts` to confirm the shape it expects. In Phase 1, `getVersion(versionState)` was called with a state shape produced by `makeVersionState`. The handler here calls `getVersion({ info: info })` — verify that matches the function's parameter type. If `getVersion` expects the raw `VersionInfo` object (not wrapped in `{ info }`), change `getVersionHandler` to:

```ts
export const getVersionHandler = Effect.gen(function* () {
	const { info } = yield* VersionState;
	return getVersion(info);
});
```

Pick whichever matches the real signature in `version-service.ts`.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

Expected: no new errors beyond baseline + the expected `index.ts` errors from Task 3. The new handlers are not yet called from `index.ts` — that happens in Task 6.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/bun/rpc-handlers.ts
git commit -m "feat(desktop): extract RPC handlers as Effects with RegistryRef refresh-on-write"
```

---

## Task 6: Rewire index.ts to use the runtime

**Files:**
- Modify: `apps/desktop/src/bun/index.ts`
- Modify: `apps/desktop/src/bun/updater.ts`

- [ ] **Step 1: Expose UpdateManager `getSettings` / add `updateSettings`**

Open `apps/desktop/src/bun/updater.ts`. Find the `private getSettings(): Promise<UpdateSettingsInfo>` method (around line 288) and change `private` to `public`:

```ts
public getSettings(): Promise<UpdateSettingsInfo> {
	return getUpdateSettings(this.settingsPath);
}
```

Then, right after that method, add a new public method:

```ts
public async updateSettings(params: {
	channel?: UpdateChannel;
	checkIntervalHours?: number;
	autoDownload?: boolean;
}): Promise<UpdateSettingsInfo> {
	const { updateUpdateSettings: updateUpdateSettingsEffect } = await import(
		"@cookielab.io/klovi-server/services/settings-service"
	);
	return Effect.runPromise(
		updateUpdateSettingsEffect(this.settingsPath, params).pipe(Effect.provide(BunContext.layer)),
	);
}
```

The `Effect` and `BunContext` imports already exist at the top of the file, so no new imports are needed.

- [ ] **Step 2: Replace index.ts**

Replace `apps/desktop/src/bun/index.ts` with the following:

```ts
import { join } from "node:path";
import { makeVersionState } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Fiber } from "effect";
import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import pkg from "../../package.json" with { type: "json" };
import type { KloviRPC } from "../shared/rpc-types.ts";
import { detectLinuxSystemTheme, ensureDesktopRuntimeDirs, resolveLinuxRenderer, type SystemTheme } from "./linux-runtime.ts";
import {
	acceptRisksHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionsHandler,
	getStatsHandler,
	getSubAgentHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
} from "./rpc-handlers.ts";
import { bridgeHandler, makeDesktopRuntime } from "./runtime.ts";
import { makeThemePollingFiber } from "./theme-polling.ts";
import { UpdateManager } from "./updater.ts";

const versionState = makeVersionState(pkg.version ?? "0.0.0", pkg.commit ?? "");

const isLinux = process.platform === "linux";
let updateManager: UpdateManager | null = null;

function getSettingsPath(): string {
	const home = Bun.env["HOME"] ?? Bun.env["USERPROFILE"] ?? "";
	return join(home, ".klovi", "settings.json");
}

const settingsPath = getSettingsPath();
ensureDesktopRuntimeDirs({
	userData: Utils.paths.userData,
	userCache: Utils.paths.userCache,
	userLogs: Utils.paths.userLogs,
});
const linuxRenderer = resolveLinuxRenderer();

const runtime = makeDesktopRuntime({
	versionInfo: versionState,
	settingsPath: settingsPath,
	appDataDir: Utils.paths.userData,
	isLinux: isLinux,
});

function getUpdateManager(): UpdateManager {
	if (!updateManager) {
		updateManager = new UpdateManager({
			currentVersion: pkg.version ?? "dev",
			platform: ({ darwin: "macos", win32: "win" } as const)[process.platform] ?? "linux",
			arch: process.arch === "arm64" ? "arm64" : "x64",
			settingsPath: settingsPath,
			appDataDir: Utils.paths.userData,
		});
	}
	return updateManager;
}

const getSystemThemeHandler = Effect.gen(function* () {
	const theme = yield* detectLinuxSystemTheme();
	return { theme: theme };
});

// Desktop RPC: native host bridge + data methods
const rpc = BrowserView.defineRPC<KloviRPC>({
	handlers: {
		requests: {
			// Native host bridge methods
			browseDirectory: async (params) => {
				const paths = await Utils.openFileDialog({
					startingFolder: params.startingFolder ?? "~/",
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});
				const selected = paths[0];
				return { path: selected && selected !== "" ? selected : null };
			},
			getUpdateSettings: () => {
				if (isLinux) {
					return Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: false });
				}
				return getUpdateManager().getSettings();
			},
			updateUpdateSettings: async (params) => {
				if (isLinux) {
					return { channel: "stable" as const, checkIntervalHours: 6, autoDownload: false };
				}
				const result = await getUpdateManager().updateSettings(params);
				await getUpdateManager().restartSchedule();
				return result;
			},
			checkForUpdate: () => {
				if (isLinux) {
					return Promise.resolve({ status: "up-to-date" as const, currentVersion: pkg.version ?? "dev" });
				}
				return getUpdateManager().check();
			},
			applyUpdate: async () => {
				if (isLinux) {
					return { ok: false, error: "Auto-update is not supported on Linux" };
				}
				try {
					await getUpdateManager().apply();
					return { ok: true };
				} catch (error) {
					return { ok: false, error: error instanceof Error ? error.message : "Update failed" };
				}
			},
			openExternal: (params) => {
				Utils.openExternal(params.url);
				return { ok: true };
			},

			// Data methods (KloviClient)
			acceptRisks: () => bridgeHandler(runtime, acceptRisksHandler),
			isFirstLaunch: () => bridgeHandler(runtime, isFirstLaunchHandler),
			getVersion: () => bridgeHandler(runtime, getVersionHandler),
			getStats: () => bridgeHandler(runtime, getStatsHandler),
			getProjects: () => bridgeHandler(runtime, getProjectsHandler),
			getSessions: (params) => bridgeHandler(runtime, getSessionsHandler(params)),
			getSession: (params) => bridgeHandler(runtime, getSessionHandler(params)),
			getSubAgent: (params) => bridgeHandler(runtime, getSubAgentHandler(params)),
			searchSessions: () => bridgeHandler(runtime, searchSessionsHandler),
			getPluginSettings: () => bridgeHandler(runtime, getPluginSettingsHandler),
			updatePluginSetting: (params) => bridgeHandler(runtime, updatePluginSettingHandler(params)),
			getGeneralSettings: () => bridgeHandler(runtime, getGeneralSettingsHandler),
			updateGeneralSettings: (params) => bridgeHandler(runtime, updateGeneralSettingsHandler(params)),
			resetSettings: () => bridgeHandler(runtime, resetSettingsHandler),
			getSystemTheme: () => bridgeHandler(runtime, getSystemThemeHandler),
		},
		messages: {},
	},
});

const win = new BrowserWindow({
	title: "Klovi",
	url: "views://main/index.html",
	frame: { x: 0, y: 0, width: 1400, height: 900 },
	...(linuxRenderer ? { renderer: linuxRenderer } : {}),
	rpc: rpc,
});

// Start update checking (skip on Linux — no auto-update support)
if (!isLinux) {
	const mgr = getUpdateManager();
	mgr.setStatusCallback((status) => {
		win.webview.rpc?.send.updateStatus(status);
	});
	await mgr.cleanup();
	await mgr.startSchedule();
}

// Application menu
ApplicationMenu.setApplicationMenu([
	{
		label: "Klovi",
		submenu: [
			{ label: "About Klovi", role: "about" },
			{ type: "separator" },
			{ label: "Preferences...", action: "openSettings", accelerator: "CmdOrCtrl+," },
			...(isLinux ? [] : [{ label: "Check for Updates...", action: "checkForUpdates" }]),
			{ type: "separator" },
			{ label: "Quit Klovi", role: "quit", accelerator: "CmdOrCtrl+q" },
		],
	},
	{
		label: "Edit",
		submenu: [{ role: "copy" }, { role: "selectAll" }],
	},
	{
		label: "View",
		submenu: [
			{ label: "Toggle Theme", action: "cycleTheme", accelerator: "t" },
			{ type: "separator" },
			{ label: "Increase Font Size", action: "increaseFontSize", accelerator: "plus" },
			{ label: "Decrease Font Size", action: "decreaseFontSize", accelerator: "minus" },
			{ type: "separator" },
			{ label: "Toggle Presentation", action: "togglePresentation", accelerator: "p" },
		],
	},
	{
		label: "Window",
		submenu: [{ role: "minimize" }, { role: "zoom" }],
	},
]);

// Forward menu actions to webview as RPC messages
Electrobun.events.on("application-menu-clicked", (e) => {
	const rpcSend = win.webview.rpc?.send;
	if (!rpcSend) {
		return;
	}
	switch (e.data.action) {
		case "cycleTheme":
			rpcSend.cycleTheme({});
			break;
		case "increaseFontSize":
			rpcSend.increaseFontSize({});
			break;
		case "decreaseFontSize":
			rpcSend.decreaseFontSize({});
			break;
		case "togglePresentation":
			rpcSend.togglePresentation({});
			break;
		case "openSettings":
			rpcSend.openSettings({});
			break;
		case "checkForUpdates":
			if (!isLinux) {
				getUpdateManager()
					.check()
					.then((result) => {
						win.webview.rpc?.send.checkForUpdatesResult(result);
					})
					.catch(() => {});
			}
			break;
	}
});

// Start Linux theme polling as an Effect fiber forked on the runtime
let themePollingFiber: Fiber.RuntimeFiber<void, never> | null = null;
if (isLinux) {
	themePollingFiber = runtime.runFork(
		makeThemePollingFiber((theme: SystemTheme) => {
			win.webview.rpc?.send.systemThemeChanged({ theme: theme });
		}),
	);
}

Electrobun.events.on("before-quit", () => {
	if (!isLinux) {
		updateManager?.stopSchedule();
	}
	if (themePollingFiber) {
		Effect.runFork(Fiber.interrupt(themePollingFiber));
	}
	void runtime.dispose();
});
```

Note: the `BrowserWindow` declaration was moved **before** the update-checking block because the update-checking block's status callback references `win`. In the original file, the update-checking block runs at the top level before `win` is declared — this is a latent bug (`win` hoisting via `var`-like TDZ semantics). Moving `win` up fixes the ordering properly.

**If `win` was genuinely declared after the update block and the app was working:** revert the move — just keep the update block after `win` declaration as shown above. The original ordering may have relied on `win` being declared with `const` and still accessible via closure capture at callback execution time (not declaration time). Inspect the pre-edit `index.ts` to confirm.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

Expected: back to the 12 baseline errors, no new ones. If there are new errors, fix them.

The 9 platform record errors at `index.ts:101` (`{ darwin: "macos"; win32: "win" }[process.platform]`) should still be present — they are baseline.

- [ ] **Step 4: Run biome check**

Run: `bun run check`

Expected: no errors. If the formatter reports issues, run:

```bash
bunx biome format --write apps/desktop/src/bun/index.ts apps/desktop/src/bun/updater.ts
```

Then re-run check.

- [ ] **Step 5: Run tests**

Run: `bun test`

Expected: 861 pass, 0 fail (Phase 1 baseline preserved). The desktop app is not tested as a running binary by unit tests — only `updater.test.ts` and `linux-runtime.test.ts` exercise desktop code, and both should still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/bun/index.ts apps/desktop/src/bun/updater.ts
git commit -m "refactor(desktop): dispatch RPC via ManagedRuntime, fork theme polling as Effect fiber"
```

---

## Task 7: Final verification and polish

- [ ] **Step 1: Verify no stale boundary helpers remain in index.ts**

Run: `grep -n "runFs\|runRegistry\|ensureRegistry\|refreshRegistry" apps/desktop/src/bun/index.ts`

Expected: no results. The local `runFs`/`runRegistry` helpers and lazy registry lifecycle are gone.

- [ ] **Step 2: Verify `setInterval` removed for theme polling**

Run: `grep -n "setInterval\|themePollingInterval\|lastLinuxTheme" apps/desktop/src/bun/index.ts`

Expected: no results. Theme polling is now an Effect fiber forked on the runtime.

- [ ] **Step 3: Verify all data RPC handlers dispatch via bridgeHandler**

Run: `grep -c "bridgeHandler(runtime" apps/desktop/src/bun/index.ts`

Expected: at least 15 (one per data handler: acceptRisks, isFirstLaunch, getVersion, getStats, getProjects, getSessions, getSession, getSubAgent, searchSessions, getPluginSettings, updatePluginSetting, getGeneralSettings, updateGeneralSettings, resetSettings, getSystemTheme).

- [ ] **Step 4: Verify runtime disposal on before-quit**

Run: `grep -n "runtime.dispose\|before-quit" apps/desktop/src/bun/index.ts`

Expected: `before-quit` handler calls `runtime.dispose()`.

- [ ] **Step 5: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: check clean (baseline warnings only), typecheck baseline (12 errors), tests 861 pass, 0 fail.

- [ ] **Step 6: Smoke test (manual)**

Have the user run `bun run dev` in `apps/desktop/` and manually verify:
- App launches without errors
- Dashboard stats load
- Projects list loads
- Clicking into a session shows session details
- Settings panel opens; plugin toggles work (registry refresh triggers after toggle)
- Reset settings works

If smoke test reveals a regression, fix it before committing polish.

- [ ] **Step 7: Commit polish (if any)**

```bash
# Only commit if step 6 required changes
git add -A
git commit -m "chore(desktop): Phase 2a cleanup after smoke test"
```

---

## Success Criteria (Phase 2a)

- [x] `apps/desktop/src/bun/services.ts` defines `VersionState`, `SettingsPathRef`, `AppDataDirRef`, `PlatformInfo`, `RegistryRef`
- [x] `apps/desktop/src/bun/runtime.ts` exposes `makeDesktopRuntime`, `refreshRegistry`, `bridgeHandler`
- [x] `apps/desktop/src/bun/rpc-handlers.ts` contains all data-method RPC handlers as Effects
- [x] Write handlers (`updatePluginSettingHandler`, `resetSettingsHandler`) call `refreshRegistry` after the write
- [x] `detectLinuxSystemTheme` returns `Effect<SystemTheme | null, never, CommandExecutor>`
- [x] `apps/desktop/src/bun/theme-polling.ts` implements polling via `Effect.schedule(..., Schedule.spaced("5 seconds"))`
- [x] `index.ts` dispatches all 15 data-method RPC calls via `bridgeHandler(runtime, ...)`
- [x] `index.ts` no longer uses `setInterval` for theme polling; it uses `runtime.runFork(...)`
- [x] `index.ts` disposes the runtime on `before-quit`
- [x] All tests pass (`bun test`)
- [x] Typecheck holds baseline (12 pre-existing errors, no new ones)
- [x] Biome check passes (`bun run check`)

---

## Non-Goals (Phase 2a)

- **Updater Effect-ification** — Phase 2b will rewrite `updater.ts` using `HttpClient`, `Schedule.exponential`, `Stream`, `SubscriptionRef`, and `Effect.acquireRelease` scopes. In Phase 2a the updater stays as-is, except that `getSettings` is promoted to public and `updateSettings` is added so `index.ts` can call them without the old `runFs` helper.
- **Frontend migration** — Phase 3.
- **`applyUpdate` error handling** — kept as try/catch in `index.ts` since the updater internals are still Promise-based.
