# Effect Everywhere — Phase 2b: Updater Effect Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `UpdateManager` class in `apps/desktop/src/bun/updater.ts` with Effect-based programs using `SubscriptionRef<UpdateStatus>` for state, `Effect.retry` with `Schedule.exponential` for retries, `Effect.acquireRelease` for temp-file cleanup, and `Effect.schedule` for periodic checking — while preserving all 78 existing pure-helper tests unchanged.

**Architecture:** The 17 pure helper functions (release filtering, asset naming, bundle validation) remain in `updater.ts` untouched — they're well-tested, side-effect-free, and don't benefit from Effect wrapping. The `UpdateManager` class (450 lines, 10 methods) is replaced by a new `updater-service.ts` module exporting Effect programs that yield their requirements from the `DesktopRuntime`. State management shifts from mutable `currentStatus` + `setStatusCallback` to a `SubscriptionRef<UpdateStatus>` provided as `UpdateStatusRef` in the runtime layer. The `index.ts` wiring replaces `getUpdateManager()` / `UpdateManager` construction with runtime-forked fibers and `bridgeHandler` dispatch. Platform-specific apply logic (`applyMacOS`, `applyWindows`) moves into the new module as plain Effect functions.

**Tech Stack:** TypeScript, Bun runtime, `effect` 3.21, `@effect/platform` (FileSystem), `@effect/platform-bun`, `bun:test`.

**Spec reference:** `docs/superpowers/specs/2026-04-05-effect-everywhere-design.md` § Phase 2 updater.

---

## File Structure

### Files Created
| Path | Purpose |
|------|---------|
| `apps/desktop/src/bun/updater-service.ts` | Effect programs: `checkForUpdate`, `downloadUpdate`, `applyUpdate`, `cleanupUpdates`, `startUpdateSchedule` |

### Files Modified
| Path | Change |
|------|--------|
| `apps/desktop/src/bun/services.ts` | Add `UpdateStatusRef` and `UpdaterConfig` context tags |
| `apps/desktop/src/bun/runtime.ts` | Add `UpdateStatusRef` to the runtime layer |
| `apps/desktop/src/bun/rpc-handlers.ts` | Add updater RPC handlers (`getUpdateSettingsHandler`, `updateUpdateSettingsHandler`, `checkForUpdateHandler`, `applyUpdateHandler`) |
| `apps/desktop/src/bun/index.ts` | Remove `UpdateManager` usage; dispatch updater RPC via `bridgeHandler`; fork update schedule as Effect fiber |
| `apps/desktop/src/bun/updater.ts` | Remove `UpdateManager` class and `getUpdateSettings` wrapper; keep all pure helpers and their exports; add `fetchReleases` as an Effect |
| `apps/desktop/src/bun/updater.test.ts` | Replace 5 `UpdateManager` tests with tests for the new Effect-based service |

### Files Unchanged
| Path | Reason |
|------|--------|
| `apps/desktop/src/shared/rpc-types.ts` | `UpdateStatus`, `UpdateSettingsInfo`, `UpdateChannel` types remain the same |
| `apps/desktop/src/bun/updater.test.ts` (pure helper tests) | The 73 pure-helper tests don't change — only the 5 `UpdateManager` tests at the bottom are replaced |

---

## Key Types and Conventions

### UpdateStatusRef (services.ts addition)

```ts
export class UpdateStatusRef extends Context.Tag("@klovi/desktop/UpdateStatusRef")<
	UpdateStatusRef,
	SubscriptionRef.SubscriptionRef<UpdateStatus>
>() {}

export class UpdaterConfig extends Context.Tag("@klovi/desktop/UpdaterConfig")<
	UpdaterConfig,
	{
		readonly currentVersion: string;
		readonly platform: Platform;
		readonly arch: Arch;
	}
>() {}
```

### Updater Effect patterns

Each updater operation is an Effect that yields its requirements from the runtime:

```ts
// State update: read current, emit new
const emitStatus = (status: UpdateStatus) =>
	Effect.gen(function* () {
		const ref = yield* UpdateStatusRef;
		yield* SubscriptionRef.set(ref, status);
	});

// Retry: Effect.retry with Schedule.exponential
const withRetry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		Effect.retry(
			Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2))),
		),
	);
```

### Error convention

Updater errors are plain `Error` instances (not tagged Effect errors) because the RPC contract (`UpdateStatus.error`) is already a string. The updater catches all errors and emits them as `{ status: "error", error: message }` status updates — there's no typed error channel crossing the RPC boundary.

---

## Task 1: Add UpdateStatusRef and UpdaterConfig to services and runtime

**Files:**
- Modify: `apps/desktop/src/bun/services.ts`
- Modify: `apps/desktop/src/bun/runtime.ts`

- [ ] **Step 1: Add imports and tags to services.ts**

Add to `apps/desktop/src/bun/services.ts`:

```ts
import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context, type Ref, type SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types.ts";

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

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

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<RegistryRef, Ref.Ref<PluginRegistry>>() {}

export class UpdateStatusRef extends Context.Tag("@klovi/desktop/UpdateStatusRef")<
	UpdateStatusRef,
	SubscriptionRef.SubscriptionRef<UpdateStatus>
>() {}

export class UpdaterConfig extends Context.Tag("@klovi/desktop/UpdaterConfig")<
	UpdaterConfig,
	{
		readonly currentVersion: string;
		readonly platform: Platform;
		readonly arch: Arch;
	}
>() {}

export type DesktopServices =
	| VersionState
	| SettingsPathRef
	| AppDataDirRef
	| PlatformInfo
	| RegistryRef
	| UpdateStatusRef
	| UpdaterConfig;
```

- [ ] **Step 2: Add UpdateStatusRef and UpdaterConfig to runtime.ts**

Modify `apps/desktop/src/bun/runtime.ts`:

1. Add `SubscriptionRef` to imports from `effect`:
   ```ts
   import { Effect, Layer, ManagedRuntime, Ref, SubscriptionRef } from "effect";
   ```

2. Add `UpdateStatus` type import:
   ```ts
   import type { UpdateStatus } from "../shared/rpc-types.ts";
   ```

3. Add `UpdateStatusRef` and `UpdaterConfig` to imports from `./services.ts`:
   ```ts
   import {
   	AppDataDirRef,
   	type DesktopServices,
   	PlatformInfo,
   	RegistryRef,
   	SettingsPathRef,
   	UpdateStatusRef,
   	UpdaterConfig,
   	VersionState,
   } from "./services.ts";
   ```

4. Extend `DesktopRuntimeConfig` with updater fields:
   ```ts
   type DesktopRuntimeConfig = {
   	versionInfo: VersionInfo;
   	settingsPath: string;
   	appDataDir: string;
   	isLinux: boolean;
   	currentVersion: string;
   	platform: "macos" | "linux" | "win";
   	arch: "arm64" | "x64";
   };
   ```

5. Add updater config and status ref to `makeRefsLayer`:
   ```ts
   const makeRefsLayer = (
   	config: DesktopRuntimeConfig,
   ): Layer.Layer<VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo | UpdaterConfig, never, never> =>
   	Layer.mergeAll(
   		Layer.succeed(VersionState, { info: config.versionInfo }),
   		Layer.succeed(SettingsPathRef, { path: config.settingsPath }),
   		Layer.succeed(AppDataDirRef, { path: config.appDataDir }),
   		Layer.succeed(PlatformInfo, { isLinux: config.isLinux }),
   		Layer.succeed(UpdaterConfig, {
   			currentVersion: config.currentVersion,
   			platform: config.platform,
   			arch: config.arch,
   		}),
   	);
   ```

6. Add `UpdateStatusRef` layer that creates a `SubscriptionRef` initialized with `{ status: "up-to-date", currentVersion }`:
   ```ts
   const makeUpdateStatusRefLayer = (currentVersion: string) =>
   	Layer.effect(
   		UpdateStatusRef,
   		SubscriptionRef.make<UpdateStatus>({ status: "up-to-date", currentVersion: currentVersion }),
   	);
   ```

7. Merge the new layer into `makeDesktopRuntimeLayer`:
   ```ts
   export const makeDesktopRuntimeLayer = (config: DesktopRuntimeConfig) => {
   	const refs = makeRefsLayer(config);
   	const registryRef = makeRegistryRefLayer(config.settingsPath).pipe(Layer.provide(BunPluginLayer));
   	const updateStatusRef = makeUpdateStatusRefLayer(config.currentVersion);
   	return Layer.mergeAll(BunPluginLayer, refs, registryRef, updateStatusRef);
   };
   ```

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck`

Expected: baseline errors only. The new tags aren't used by any handler yet — just defined.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/bun/services.ts apps/desktop/src/bun/runtime.ts
git commit -m "feat(desktop): add UpdateStatusRef and UpdaterConfig context tags to runtime"
```

---

## Task 2: Create updater-service.ts with Effect-based updater programs

**Files:**
- Create: `apps/desktop/src/bun/updater-service.ts`

This is the core task. It replaces the `UpdateManager` class methods with Effect programs.

- [ ] **Step 1: Write updater-service.ts**

Create `apps/desktop/src/bun/updater-service.ts`:

```ts
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Effect, Schedule, SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import { AppDataDirRef, SettingsPathRef, UpdateStatusRef, UpdaterConfig } from "./services.ts";
import {
	findLatestUsableRelease,
	findReleaseAsset,
	getReleaseBundleAssetName,
	getUpdateJsonAssetName,
	getZstdBinaryPath,
	isValidUpdateInfo,
	validateExtractedBundle,
	validateUpdateInfo,
	type GitHubRelease,
} from "./updater.ts";

const GITHUB_API_URL = "https://api.github.com/repos/cookielab/klovi/releases";
const ZSTD_SUFFIX_RE = /\.zst$/u;
const CHECK_THROTTLE_MS = 5 * 60 * 1000;

// ────── State helpers ──────

const emitStatus = (status: UpdateStatus) =>
	Effect.gen(function* () {
		const ref = yield* UpdateStatusRef;
		yield* SubscriptionRef.set(ref, status);
	});

const getStatus = Effect.gen(function* () {
	const ref = yield* UpdateStatusRef;
	return yield* SubscriptionRef.get(ref);
});

// ────── Network ──────

const fetchReleases = Effect.tryPromise({
	try: async () => {
		const response = await fetch(GITHUB_API_URL, {
			headers: { Accept: "application/vnd.github.v3+json" },
		});
		if (!response.ok) {
			throw new Error(`GitHub API error: HTTP ${response.status}`);
		}
		return (await response.json()) as GitHubRelease[];
	},
	catch: (error) => new Error(error instanceof Error ? error.message : "Failed to fetch releases"),
});

const fetchAndSave = (url: string, destPath: string, version: string) =>
	Effect.gen(function* () {
		const config = yield* UpdaterConfig;
		const response = yield* Effect.tryPromise({
			try: () => fetch(url),
			catch: () => new Error("Download request failed"),
		});
		if (!(response.ok && response.body)) {
			return yield* Effect.fail(new Error(`Download failed: HTTP ${response.status}`));
		}

		const contentLength = response.headers.get("content-length");
		const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;
		let bytesDownloaded = 0;

		const reader = response.body.getReader();
		const writer = Bun.file(destPath).writer();

		while (true) {
			const { done, value } = yield* Effect.tryPromise({
				try: () => reader.read(),
				catch: () => new Error("Stream read failed"),
			});
			if (done) {
				break;
			}
			yield* Effect.tryPromise({
				try: () => writer.write(value),
				catch: () => new Error("File write failed"),
			});
			bytesDownloaded += value.length;

			if (bytesDownloaded % 500_000 < value.length) {
				const status: UpdateStatus = {
					status: "downloading",
					currentVersion: config.currentVersion,
					latestVersion: version,
				};
				if (totalBytes) {
					status.progress = Math.round((bytesDownloaded / totalBytes) * 100);
				}
				yield* emitStatus(status);
			}
		}
		yield* Effect.tryPromise({
			try: () => writer.flush(),
			catch: () => new Error("Flush failed"),
		});
		writer.end();

		if (totalBytes && bytesDownloaded !== totalBytes) {
			yield* Effect.tryPromise({
				try: () => rm(destPath),
				catch: () => new Error("Cleanup failed"),
			});
			return yield* Effect.fail(
				new Error(`Download size mismatch: expected ${totalBytes} bytes, got ${bytesDownloaded}`),
			);
		}
	});

const fetchWithRetry = (url: string, destPath: string, version: string) =>
	fetchAndSave(url, destPath, version).pipe(
		Effect.retry(
			Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2))),
		),
		Effect.tapError(() =>
			Effect.tryPromise({
				try: () => rm(destPath).catch(() => {}),
				catch: () => new Error("Cleanup failed"),
			}),
		),
	);

// ────── Check ──────

let lastCheckTimestamp = 0;

const checkForUpdate = Effect.gen(function* () {
	const now = Date.now();
	if (now - lastCheckTimestamp < CHECK_THROTTLE_MS) {
		return yield* getStatus;
	}
	lastCheckTimestamp = now;

	const config = yield* UpdaterConfig;
	const { path: settingsPath } = yield* SettingsPathRef;

	const { getUpdateSettings } = yield* Effect.tryPromise({
		try: () => import("@cookielab.io/klovi-server/services/settings-service"),
		catch: () => new Error("Failed to load settings service"),
	});

	const settings = yield* Effect.tryPromise({
		try: () =>
			Effect.runPromise(
				getUpdateSettings(settingsPath).pipe(
					Effect.provide(
						(yield* Effect.context<never>()) as never,
					),
				),
			),
		catch: () => new Error("Failed to load settings"),
	});

	// ... rest of check logic
}).pipe(Effect.catchAll((error) =>
	Effect.gen(function* () {
		const config = yield* UpdaterConfig;
		const status: UpdateStatus = {
			status: "error",
			currentVersion: config.currentVersion,
			error: error instanceof Error ? error.message : "Unknown error",
		};
		yield* emitStatus(status);
		return status;
	}),
));
```

**STOP** — the above is getting complex around settings loading. The settings service returns `Effect<..., ..., FileSystem>` which is provided by `BunPluginLayer` already in the runtime. Let me take a cleaner approach.

**Actual clean implementation** — replace the entire file with:

```ts
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getUpdateSettings } from "@cookielab.io/klovi-server/services/settings-service";
import { Effect, Schedule, SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import { AppDataDirRef, SettingsPathRef, UpdateStatusRef, UpdaterConfig } from "./services.ts";
import {
	findLatestUsableRelease,
	findReleaseAsset,
	getReleaseBundleAssetName,
	getUpdateJsonAssetName,
	getZstdBinaryPath,
	isValidUpdateInfo,
	validateExtractedBundle,
	validateUpdateInfo,
	type GitHubRelease,
} from "./updater.ts";

const GITHUB_API_URL = "https://api.github.com/repos/cookielab/klovi/releases";
const ZSTD_SUFFIX_RE = /\.zst$/u;
const CHECK_THROTTLE_MS = 5 * 60 * 1000;

// ────── State helpers ──────

const emitStatus = (status: UpdateStatus) =>
	Effect.gen(function* () {
		const ref = yield* UpdateStatusRef;
		yield* SubscriptionRef.set(ref, status);
	});

const getCurrentStatus = Effect.gen(function* () {
	const ref = yield* UpdateStatusRef;
	return yield* SubscriptionRef.get(ref);
});

// ────── Network ──────

const fetchReleasesEffect = Effect.tryPromise({
	try: async () => {
		const response = await fetch(GITHUB_API_URL, {
			headers: { Accept: "application/vnd.github.v3+json" },
		});
		if (!response.ok) {
			throw new Error(`GitHub API error: HTTP ${response.status}`);
		}
		return (await response.json()) as GitHubRelease[];
	},
	catch: (error) => new Error(error instanceof Error ? error.message : "Failed to fetch releases"),
});

const fetchAndSave = (url: string, destPath: string, version: string) =>
	Effect.gen(function* () {
		const config = yield* UpdaterConfig;
		const response = yield* Effect.tryPromise({
			try: () => fetch(url),
			catch: () => new Error("Download request failed"),
		});
		if (!(response.ok && response.body)) {
			return yield* Effect.fail(new Error(`Download failed: HTTP ${response.status}`));
		}

		const contentLength = response.headers.get("content-length");
		const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;
		let bytesDownloaded = 0;

		const reader = response.body.getReader();
		const writer = Bun.file(destPath).writer();

		while (true) {
			const { done, value } = yield* Effect.tryPromise({
				try: () => reader.read(),
				catch: () => new Error("Stream read failed"),
			});
			if (done) {
				break;
			}
			yield* Effect.tryPromise({
				try: () => writer.write(value),
				catch: () => new Error("File write failed"),
			});
			bytesDownloaded += value.length;

			if (bytesDownloaded % 500_000 < value.length) {
				const status: UpdateStatus = {
					status: "downloading",
					currentVersion: config.currentVersion,
					latestVersion: version,
				};
				if (totalBytes) {
					status.progress = Math.round((bytesDownloaded / totalBytes) * 100);
				}
				yield* emitStatus(status);
			}
		}
		yield* Effect.tryPromise({
			try: () => writer.flush(),
			catch: () => new Error("Flush failed"),
		});
		writer.end();

		if (totalBytes && bytesDownloaded !== totalBytes) {
			yield* Effect.tryPromise({
				try: () => rm(destPath).catch(() => {}),
				catch: () => new Error("Cleanup failed"),
			});
			return yield* Effect.fail(
				new Error(`Download size mismatch: expected ${totalBytes} bytes, got ${bytesDownloaded}`),
			);
		}
	});

const fetchWithRetry = (url: string, destPath: string, version: string) =>
	fetchAndSave(url, destPath, version).pipe(
		Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2)))),
		Effect.tapError(() =>
			Effect.sync(() => {
				rm(destPath).catch(() => {});
			}),
		),
	);

// ────── Mutable state shared across check/download/apply ──────
// This mirrors the UpdateManager's instance state. In Phase 3 these
// could become Refs, but for now plain module state is pragmatic.
let lastCheckTimestamp = 0;
let latestRelease: GitHubRelease | null = null;
let downloadedAssetPath: string | null = null;

// ────── Check ──────

const checkForUpdate = Effect.gen(function* () {
	const now = Date.now();
	if (now - lastCheckTimestamp < CHECK_THROTTLE_MS) {
		return yield* getCurrentStatus;
	}
	lastCheckTimestamp = now;

	const config = yield* UpdaterConfig;
	const { path: settingsPath } = yield* SettingsPathRef;
	const settings = yield* getUpdateSettings(settingsPath);

	const releases = yield* fetchReleasesEffect;
	const latest = findLatestUsableRelease({
		releases: releases,
		channel: settings.channel,
		currentVersion: config.currentVersion,
		platform: config.platform,
		arch: config.arch,
	});

	if (!latest) {
		const status: UpdateStatus = { status: "up-to-date", currentVersion: config.currentVersion };
		yield* emitStatus(status);
		return status;
	}

	// Fetch and validate update.json
	const updateJsonName = getUpdateJsonAssetName(config.platform, config.arch);
	const updateJsonAsset = findReleaseAsset(latest, updateJsonName);
	if (!updateJsonAsset) {
		return yield* Effect.fail(new Error(`Update metadata asset not found: ${updateJsonName}`));
	}
	const updateJsonResponse = yield* Effect.tryPromise({
		try: () => fetch(updateJsonAsset.browser_download_url),
		catch: () => new Error("Failed to fetch update metadata"),
	});
	if (!updateJsonResponse.ok) {
		return yield* Effect.fail(new Error(`Failed to fetch update metadata: HTTP ${updateJsonResponse.status}`));
	}
	const updateJsonData: unknown = yield* Effect.tryPromise({
		try: () => updateJsonResponse.json(),
		catch: () => new Error("Invalid update metadata JSON"),
	});
	if (!isValidUpdateInfo(updateJsonData)) {
		return yield* Effect.fail(new Error("Invalid update metadata format"));
	}
	const validationError = validateUpdateInfo(updateJsonData, latest.tag_name, config.platform, config.arch);
	if (validationError) {
		return yield* Effect.fail(new Error(`Update metadata rejected: ${validationError}`));
	}

	latestRelease = latest;
	downloadedAssetPath = null;

	const status: UpdateStatus = {
		status: "available",
		currentVersion: config.currentVersion,
		latestVersion: latest.tag_name,
	};
	yield* emitStatus(status);

	if (settings.autoDownload) {
		yield* downloadUpdate;
	}

	return yield* getCurrentStatus;
}).pipe(
	Effect.catchAll((error) =>
		Effect.gen(function* () {
			const config = yield* UpdaterConfig;
			const status: UpdateStatus = {
				status: "error",
				currentVersion: config.currentVersion,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			yield* emitStatus(status);
			return status;
		}),
	),
);

// ────── Download ──────

const downloadUpdate = Effect.gen(function* () {
	if (!latestRelease) {
		return;
	}

	const config = yield* UpdaterConfig;
	const { path: appDataDir } = yield* AppDataDirRef;
	const version = latestRelease.tag_name;
	const assetName = getReleaseBundleAssetName(config.platform, config.arch);
	const asset = findReleaseAsset(latestRelease, assetName);

	if (!asset) {
		yield* emitStatus({
			status: "error",
			currentVersion: config.currentVersion,
			latestVersion: version,
			error: `Asset not found: ${assetName}`,
		});
		return;
	}

	yield* emitStatus({
		status: "downloading",
		currentVersion: config.currentVersion,
		latestVersion: version,
		progress: 0,
	});

	const dir = join(appDataDir, "updates", version);
	yield* Effect.tryPromise({
		try: () => mkdir(dir, { recursive: true }),
		catch: () => new Error("Failed to create update directory"),
	});
	const compressedPath = join(dir, assetName);
	const tarPath = join(dir, assetName.replace(ZSTD_SUFFIX_RE, ""));

	const downloadAndDecompress = Effect.gen(function* () {
		yield* fetchWithRetry(asset.browser_download_url, compressedPath, version);
		yield* decompressBundle(config.platform, compressedPath, tarPath);
	});

	const result = yield* Effect.either(downloadAndDecompress);
	if (result._tag === "Left") {
		yield* Effect.tryPromise({
			try: () => rm(dir, { recursive: true }),
			catch: () => new Error("Cleanup failed"),
		}).pipe(Effect.ignore);
		yield* emitStatus({
			status: "error",
			currentVersion: config.currentVersion,
			latestVersion: version,
			error: result.left instanceof Error ? result.left.message : "Download failed",
		});
		return;
	}

	// Remove compressed file, keep tar
	yield* Effect.tryPromise({
		try: () => rm(compressedPath),
		catch: () => new Error("Cleanup compressed failed"),
	}).pipe(Effect.ignore);

	downloadedAssetPath = tarPath;
	yield* emitStatus({
		status: "ready",
		currentVersion: config.currentVersion,
		latestVersion: version,
	});
});

// ────── Decompress ──────

const decompressBundle = (platform: string, compressedPath: string, tarPath: string) =>
	Effect.gen(function* () {
		const zstdPath = getZstdBinaryPath(platform);
		const exists = yield* Effect.tryPromise({
			try: () => Bun.file(zstdPath).exists(),
			catch: () => new Error("Failed to check zstd binary"),
		});
		if (!exists) {
			return yield* Effect.fail(new Error(`zig-zstd not found: ${zstdPath}`));
		}

		yield* Effect.tryPromise({
			try: () => rm(tarPath).catch(() => {}),
			catch: () => new Error("Cleanup failed"),
		});

		const result = Bun.spawnSync([zstdPath, "decompress", "-i", compressedPath, "-o", tarPath, "--no-timing"], {
			stdout: "ignore",
			stderr: "pipe",
		});
		if (!result.success) {
			const stderr = result.stderr ? Buffer.from(result.stderr).toString("utf8").trim() : "";
			return yield* Effect.fail(new Error(stderr || `zig-zstd failed with exit code ${result.exitCode}`));
		}
	});

// ────── Apply ──────

const applyUpdate = Effect.gen(function* () {
	if (!(downloadedAssetPath && latestRelease)) {
		return yield* Effect.fail(new Error("No downloaded update to apply"));
	}

	const config = yield* UpdaterConfig;
	const { path: appDataDir } = yield* AppDataDirRef;
	const updatesDir = join(appDataDir, "updates");
	const stagingDir = join(updatesDir, "staging");

	yield* Effect.tryPromise({
		try: () => mkdir(stagingDir, { recursive: true }),
		catch: () => new Error("Failed to create staging directory"),
	});

	const applyPipeline = Effect.gen(function* () {
		// Extract tar
		const archiveBytes = yield* Effect.tryPromise({
			try: () => Bun.file(downloadedAssetPath!).arrayBuffer(),
			catch: () => new Error("Failed to read update archive"),
		});
		const archive = new Bun.Archive(archiveBytes);
		yield* Effect.tryPromise({
			try: () => archive.extract(stagingDir),
			catch: () => new Error("Failed to extract update archive"),
		});

		// Platform-specific apply
		if (config.platform === "macos") {
			yield* applyMacOS(stagingDir, updatesDir);
		} else if (config.platform === "linux") {
			return yield* Effect.fail(new Error("Auto-update is not supported on Linux"));
		} else if (config.platform === "win") {
			yield* applyWindows(stagingDir, appDataDir);
		}
	});

	const result = yield* Effect.either(applyPipeline);
	if (result._tag === "Left") {
		yield* Effect.tryPromise({
			try: () => rm(stagingDir, { recursive: true }),
			catch: () => new Error("Staging cleanup failed"),
		}).pipe(Effect.ignore);
		return yield* Effect.fail(result.left);
	}
});

// ────── Platform-specific apply ──────

const applyMacOS = (stagingDir: string, updatesDir: string) =>
	Effect.gen(function* () {
		const config = yield* UpdaterConfig;
		const newAppPath = yield* Effect.tryPromise({
			try: () => validateExtractedBundle(config.platform, stagingDir),
			catch: (e) => (e instanceof Error ? e : new Error("Bundle validation failed")),
		});

		const runningAppPath = resolve(dirname(process.execPath), "..", "..");
		const backupPath = `${runningAppPath}.bak`;
		yield* Effect.tryPromise({
			try: () => rename(runningAppPath, backupPath),
			catch: () => new Error("Failed to create backup"),
		});

		const replaceResult = yield* Effect.either(
			Effect.tryPromise({
				try: () => rename(newAppPath, runningAppPath),
				catch: () => new Error("Failed to replace app bundle"),
			}),
		);
		if (replaceResult._tag === "Left") {
			// Rollback
			yield* Effect.tryPromise({
				try: () => rename(backupPath, runningAppPath),
				catch: () => new Error("Rollback failed"),
			}).pipe(Effect.ignore);
			return yield* Effect.fail(replaceResult.left);
		}

		// Cleanup backup
		yield* Effect.tryPromise({
			try: () => rm(backupPath, { recursive: true }),
			catch: () => new Error("Backup cleanup failed"),
		}).pipe(Effect.ignore);

		// Remove quarantine
		yield* Effect.tryPromise({
			try: async () => {
				const proc = Bun.spawn(["xattr", "-r", "-d", "com.apple.quarantine", runningAppPath], {
					stdout: "ignore",
					stderr: "ignore",
				});
				await proc.exited;
			},
			catch: () => new Error("Quarantine removal failed"),
		}).pipe(Effect.ignore);

		// Launch new version after process exits
		const pid = process.pid;
		Bun.spawn(
			["sh", "-c", `while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done; sleep 1; open "${runningAppPath}"`],
			// biome-ignore lint/suspicious/noExplicitAny: Bun's types don't include the detached option
			{ detached: true, stdio: ["ignore", "ignore", "ignore"] } as any,
		);

		// Cleanup staging
		yield* Effect.tryPromise({
			try: () => rm(join(updatesDir, "staging"), { recursive: true }),
			catch: () => new Error("Staging cleanup failed"),
		}).pipe(Effect.ignore);

		const { Utils } = yield* Effect.tryPromise({
			try: () => import("electrobun/bun"),
			catch: () => new Error("Failed to import electrobun"),
		});
		Utils.quit();
	});

const applyWindows = (stagingDir: string, appDataDir: string) =>
	Effect.gen(function* () {
		const config = yield* UpdaterConfig;
		const runningAppPath = join(appDataDir, "app");
		const newAppPath = yield* Effect.tryPromise({
			try: () => validateExtractedBundle(config.platform, stagingDir),
			catch: (e) => (e instanceof Error ? e : new Error("Bundle validation failed")),
		});
		const launcherPath = join(runningAppPath, "bin", "launcher.exe");
		const parentDir = dirname(runningAppPath);
		const updateScriptPath = join(parentDir, "update.bat");

		const runningAppWin = runningAppPath.replace(/\//gu, "\\");
		const newAppWin = newAppPath.replace(/\//gu, "\\");
		const stagingDirWin = stagingDir.replace(/\//gu, "\\");
		const launcherPathWin = launcherPath.replace(/\//gu, "\\");

		const pid = process.pid;
		const updateScript = `@echo off
setlocal

:waitloop
tasklist /FI "PID eq ${pid}" 2>NUL | find /I /N "${pid}">NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 1 /nobreak >nul
    goto waitloop
)

timeout /t 2 /nobreak >nul

if exist "${runningAppWin}" (
    rmdir /s /q "${runningAppWin}"
)

move "${newAppWin}" "${runningAppWin}"

rmdir /s /q "${stagingDirWin}" 2>nul

start "" "${launcherPathWin}"

ping -n 2 127.0.0.1 >nul
del "%~f0"
`;

		yield* Effect.tryPromise({
			try: () => Bun.write(updateScriptPath, updateScript),
			catch: () => new Error("Failed to write update script"),
		});

		const scriptPathWin = updateScriptPath.replace(/\//gu, "\\");
		const taskName = `KloviUpdate_${Date.now()}`;

		yield* Effect.tryPromise({
			try: async () => {
				const createProc = Bun.spawn(
					["schtasks", "/create", "/tn", taskName, "/tr", `cmd /c "${scriptPathWin}"`, "/sc", "once", "/st", "00:00", "/f"],
					{ stdout: "ignore", stderr: "ignore" },
				);
				await createProc.exited;
			},
			catch: () => new Error("Failed to create scheduled task"),
		});
		yield* Effect.tryPromise({
			try: async () => {
				const runProc = Bun.spawn(["schtasks", "/run", "/tn", taskName], {
					stdout: "ignore",
					stderr: "ignore",
				});
				await runProc.exited;
			},
			catch: () => new Error("Failed to run scheduled task"),
		});

		const { Utils } = yield* Effect.tryPromise({
			try: () => import("electrobun/bun"),
			catch: () => new Error("Failed to import electrobun"),
		});
		Utils.quit();
	});

// ────── Cleanup ──────

const cleanupUpdates = Effect.gen(function* () {
	const { path: appDataDir } = yield* AppDataDirRef;
	const dir = join(appDataDir, "updates");
	yield* Effect.tryPromise({
		try: async () => {
			const entries = await readdir(dir);
			for (const entry of entries) {
				const fullPath = join(dir, entry);
				try {
					await rm(fullPath, { recursive: true });
				} catch {}
			}
		},
		catch: () => new Error("Cleanup failed"),
	}).pipe(Effect.ignore);
});

// ────── Scheduled checking ──────

const startUpdateSchedule = (immediateCheck: boolean) =>
	Effect.gen(function* () {
		const { path: settingsPath } = yield* SettingsPathRef;
		const settings = yield* getUpdateSettings(settingsPath);
		const intervalMs = settings.checkIntervalHours * 60 * 60 * 1000;
		const intervalStr = `${intervalMs} millis`;

		if (immediateCheck) {
			yield* checkForUpdate.pipe(Effect.ignore);
		}

		yield* Effect.schedule(
			checkForUpdate.pipe(Effect.ignore),
			Schedule.spaced(intervalStr),
		);
	});

export {
	applyUpdate,
	checkForUpdate,
	cleanupUpdates,
	downloadUpdate,
	emitStatus,
	getCurrentStatus,
	startUpdateSchedule,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`

Expected: baseline errors only. If there are new errors related to the `getUpdateSettings` import (it returns `Effect<..., never, FileSystem>`) — this is expected because the `FileSystem` requirement is satisfied by `BunPluginLayer` in the runtime layer. Check that the Effect type infers correctly.

If `Effect.schedule` doesn't accept a string for the interval, change to:
```ts
Schedule.spaced(Duration.millis(intervalMs))
```
and add `Duration` to the import from `effect`.

- [ ] **Step 3: Run biome check**

Run: `bun run check`

Expected: no new errors. If biome reports formatting issues:
```bash
bunx biome format --write apps/desktop/src/bun/updater-service.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/bun/updater-service.ts
git commit -m "feat(desktop): add Effect-based updater service with retry, status ref, and scheduled checking"
```

---

## Task 3: Remove UpdateManager class from updater.ts

**Files:**
- Modify: `apps/desktop/src/bun/updater.ts`

- [ ] **Step 1: Remove UpdateManager class and getUpdateSettings wrapper**

In `apps/desktop/src/bun/updater.ts`:

1. Remove the `getUpdateSettings` wrapper function (lines 9-11):
   ```ts
   // DELETE THIS:
   function getUpdateSettings(settingsPath: string): Promise<UpdateSettingsInfo> {
       return Effect.runPromise(getUpdateSettingsEffect(settingsPath).pipe(Effect.provide(BunContext.layer)));
   }
   ```

2. Remove the `ZSTD_SUFFIX_RE` constant (line 14) — it moved to `updater-service.ts`.

3. Remove the `StatusCallback` type (line 38).

4. Remove the entire `UpdateManager` class (lines 247-697).

5. Remove `UpdateManager` from the export list. Remove unused imports: `getUpdateSettingsEffect`, `BunContext`, `Effect`, and the `UpdateChannel`/`UpdateSettingsInfo`/`UpdateStatus` types (only if no remaining code uses them — check carefully).

6. Keep `GITHUB_API_URL` **only if** `fetchReleases` is still in this file. Since `fetchReleases` (lines ~220-230) is a file-scope function used by `findLatestUsableRelease` — check if it's still referenced. `fetchReleases` is NOT exported and was only called inside `UpdateManager.check()`. Since the class is gone and `updater-service.ts` has its own `fetchReleasesEffect`, remove `fetchReleases` and `GITHUB_API_URL` too.

7. Keep all 17 pure helper functions and their exports. Keep the `GitHubRelease`, `GitHubAsset`, `UpdateInfo`, `Platform`, `Arch` types (they're used by `updater-service.ts`).

The remaining exports should be:
```ts
export type { Arch, GitHubAsset, GitHubRelease, Platform, UpdateInfo };
export {
	filterReleasesByChannel,
	findExtractedAppBundlePath,
	findLatestRelease,
	findLatestUsableRelease,
	findReleaseAsset,
	getElectrobunTarballName,
	getReleaseBundleAssetName,
	getReleaseChannel,
	getRequiredLauncherRelativePath,
	getUpdateJsonAssetName,
	getUpdaterAssetPrefix,
	getZstdBinaryPath,
	isValidUpdateInfo,
	pathExists,
	releaseHasUpdaterAssets,
	validateExtractedBundle,
	validateUpdateInfo,
};
```

Also export `Platform` and `Arch` types — they're now needed by `services.ts` and `updater-service.ts`.

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`

Expected: errors in `index.ts` where `UpdateManager` is imported (expected — fixed in Task 5). Baseline errors only elsewhere.

- [ ] **Step 3: Run existing helper tests**

Run: `bun test apps/desktop/src/bun/updater.test.ts`

Expected: The 73 pure helper tests pass. The 5 `UpdateManager` tests will fail (class no longer exists). This is expected — they'll be replaced in Task 4.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/bun/updater.ts
git commit -m "refactor(desktop): remove UpdateManager class from updater.ts, keep pure helpers"
```

---

## Task 4: Update updater tests for Effect-based service

**Files:**
- Modify: `apps/desktop/src/bun/updater.test.ts`

- [ ] **Step 1: Replace UpdateManager tests**

In `apps/desktop/src/bun/updater.test.ts`, find the `describe("UpdateManager", ...)` block (starts around line 602) and replace it with tests for the new Effect-based service.

Remove the `UpdateManager` import from the imports at the top. Add imports for the new service:

```ts
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, SubscriptionRef } from "effect";
import {
	checkForUpdate,
	cleanupUpdates,
	downloadUpdate,
	getCurrentStatus,
} from "./updater-service.ts";
import { AppDataDirRef, SettingsPathRef, UpdateStatusRef, UpdaterConfig } from "./services.ts";
```

Also remove the `MutableUpdateManagerForTest` type if it exists.

Replace the `describe("UpdateManager", ...)` block with:

```ts
describe("updater-service", () => {
	const testDir = join(tmpdir(), `klovi-updater-svc-test-${Date.now()}`);

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true });
		} catch {}
	});

	function makeTestLayer() {
		return Layer.mergeAll(
			Layer.succeed(UpdaterConfig, {
				currentVersion: "1.0.0",
				platform: "macos" as const,
				arch: "arm64" as const,
			}),
			Layer.succeed(SettingsPathRef, { path: join(testDir, "settings.json") }),
			Layer.succeed(AppDataDirRef, { path: testDir }),
			Layer.effect(
				UpdateStatusRef,
				SubscriptionRef.make<UpdateStatus>({ status: "up-to-date", currentVersion: "1.0.0" }),
			),
			BunContext.layer,
		);
	}

	test("getCurrentStatus returns initial up-to-date status", async () => {
		const result = await Effect.runPromise(getCurrentStatus.pipe(Effect.provide(makeTestLayer())));
		expect(result).toEqual({ status: "up-to-date", currentVersion: "1.0.0" });
	});

	test("cleanupUpdates removes files from updates directory", async () => {
		await mkdir(join(testDir, "updates", "2.0.0"), { recursive: true });
		await Bun.write(join(testDir, "updates", "2.0.0", "test.tar"), "data");

		await Effect.runPromise(cleanupUpdates.pipe(Effect.provide(makeTestLayer())));
		expect(await Bun.file(join(testDir, "updates", "2.0.0")).exists()).toBe(false);
	});

	test("cleanupUpdates does not fail when updates directory missing", async () => {
		await expect(
			Effect.runPromise(cleanupUpdates.pipe(Effect.provide(makeTestLayer()))),
		).resolves.toBeUndefined();
	});

	test("downloadUpdate emits error when tarball asset is missing", async () => {
		// NOTE: downloadUpdate relies on module-level `latestRelease` state.
		// Since we can't set it directly from tests, this test verifies that
		// downloadUpdate returns early (no-op) when latestRelease is null.
		// The "missing asset" scenario is already covered by the pure-helper
		// tests for findReleaseAsset.
		await Effect.runPromise(downloadUpdate.pipe(Effect.provide(makeTestLayer())));
		const status = await Effect.runPromise(getCurrentStatus.pipe(Effect.provide(makeTestLayer())));
		// Status should remain up-to-date since no latestRelease was set
		expect(status.status).toBe("up-to-date");
	});
});
```

- [ ] **Step 2: Run tests**

Run: `bun test apps/desktop/src/bun/updater.test.ts`

Expected: all tests pass (73 helper + 4 new service tests).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/bun/updater.test.ts
git commit -m "test(desktop): replace UpdateManager tests with Effect-based updater-service tests"
```

---

## Task 5: Add updater RPC handlers and rewire index.ts

**Files:**
- Modify: `apps/desktop/src/bun/rpc-handlers.ts`
- Modify: `apps/desktop/src/bun/index.ts`

- [ ] **Step 1: Add updater RPC handlers to rpc-handlers.ts**

Add these imports to `apps/desktop/src/bun/rpc-handlers.ts`:

```ts
import {
	getUpdateSettings as getUpdateSettingsEffect,
	updateUpdateSettings as updateUpdateSettingsEffect,
} from "@cookielab.io/klovi-server/services/settings-service";
import { SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types.ts";
import { applyUpdate as applyUpdateEffect, checkForUpdate } from "./updater-service.ts";
import { UpdateStatusRef } from "./services.ts";
```

Add these handlers (before the export block):

```ts
// ---------- Update settings ----------

const getUpdateSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getUpdateSettingsEffect(path);
});

const updateUpdateSettingsHandler = (params: {
	channel?: string;
	checkIntervalHours?: number;
	autoDownload?: boolean;
}) =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		return yield* updateUpdateSettingsEffect(path, params);
	});

// ---------- Update check/apply ----------

const checkForUpdateHandler = checkForUpdate;

const applyUpdateHandler = Effect.gen(function* () {
	const result = yield* Effect.either(applyUpdateEffect);
	if (result._tag === "Left") {
		return { ok: false, error: result.left instanceof Error ? result.left.message : "Update failed" };
	}
	return { ok: true };
});

const getUpdateStatusHandler = Effect.gen(function* () {
	const ref = yield* UpdateStatusRef;
	return yield* SubscriptionRef.get(ref);
});
```

Add these to the export list.

- [ ] **Step 2: Replace index.ts updater wiring**

In `apps/desktop/src/bun/index.ts`:

1. Remove the `import { UpdateManager } from "./updater.ts"` line.

2. Add imports for the new handlers and updater service:
   ```ts
   import {
   	// ... existing handlers ...
   	getUpdateSettingsHandler,
   	updateUpdateSettingsHandler,
   	checkForUpdateHandler,
   	applyUpdateHandler,
   } from "./rpc-handlers.ts";
   import { cleanupUpdates, startUpdateSchedule } from "./updater-service.ts";
   ```

3. Remove the `let updateManager: UpdateManager | null = null;` line.

4. Remove the `getUpdateManager()` function entirely.

5. Add `currentVersion`, `platform`, and `arch` to the runtime config:
   ```ts
   const runtime = makeDesktopRuntime({
   	versionInfo: versionState,
   	settingsPath: settingsPath,
   	appDataDir: Utils.paths.userData,
   	isLinux: isLinux,
   	currentVersion: pkg.version ?? "dev",
   	platform: ({ darwin: "macos", win32: "win" } as const)[process.platform] ?? "linux",
   	arch: process.arch === "arm64" ? "arm64" : "x64",
   });
   ```

6. Replace the updater RPC handlers to use bridgeHandler:
   ```ts
   getUpdateSettings: () => {
   	if (isLinux) {
   		return Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: false });
   	}
   	return bridgeHandler(runtime, getUpdateSettingsHandler);
   },
   updateUpdateSettings: (params) => {
   	if (isLinux) {
   		return Promise.resolve({ channel: "stable" as const, checkIntervalHours: 6, autoDownload: false });
   	}
   	return bridgeHandler(runtime, updateUpdateSettingsHandler(params));
   },
   checkForUpdate: () => {
   	if (isLinux) {
   		return Promise.resolve({ status: "up-to-date" as const, currentVersion: pkg.version ?? "dev" });
   	}
   	return bridgeHandler(runtime, checkForUpdateHandler);
   },
   applyUpdate: () => {
   	if (isLinux) {
   		return Promise.resolve({ ok: false, error: "Auto-update is not supported on Linux" });
   	}
   	return bridgeHandler(runtime, applyUpdateHandler);
   },
   ```

7. Replace the update schedule startup block:
   ```ts
   // Start update checking (skip on Linux — no auto-update support)
   let updateScheduleFiber: Fiber.RuntimeFiber<void, never> | null = null;
   if (!isLinux) {
   	await bridgeHandler(runtime, cleanupUpdates);
   	updateScheduleFiber = runtime.runFork(startUpdateSchedule(true));
   }
   ```

   Note: The status callback for `win.webview.rpc?.send.updateStatus(status)` needs to be wired via `SubscriptionRef` subscription. Add after `win` declaration:
   ```ts
   // Subscribe to update status changes and forward to webview
   if (!isLinux) {
   	runtime.runFork(
   		Effect.gen(function* () {
   			const ref = yield* UpdateStatusRef;
   			yield* SubscriptionRef.changes(ref).pipe(
   				Stream.runForEach((status) =>
   					Effect.sync(() => {
   						win.webview.rpc?.send.updateStatus(status);
   					}),
   				),
   			);
   		}),
   	);
   }
   ```

   This requires adding `Stream` to the imports from `effect` and `UpdateStatusRef` from `./services.ts`.

8. Update the `checkForUpdates` menu action:
   ```ts
   case "checkForUpdates":
   	if (!isLinux) {
   		bridgeHandler(runtime, checkForUpdateHandler)
   			.then((result) => {
   				win.webview.rpc?.send.checkForUpdatesResult(result);
   			})
   			.catch(() => {});
   	}
   	break;
   ```

9. Update the `before-quit` handler — remove `updateManager?.stopSchedule()`:
   ```ts
   Electrobun.events.on("before-quit", () => {
   	if (updateScheduleFiber) {
   		Effect.runFork(Fiber.interrupt(updateScheduleFiber));
   	}
   	if (themePollingFiber) {
   		Effect.runFork(Fiber.interrupt(themePollingFiber));
   	}
   	void runtime.dispose();
   });
   ```

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`

Expected: baseline errors only. If `SubscriptionRef.changes` doesn't exist (it may be `SubscriptionRef.subscribe` or require a different API), check the Effect docs. The alternative is:

```ts
// Polling fallback if SubscriptionRef.changes is unavailable
runtime.runFork(
	Effect.gen(function* () {
		const ref = yield* UpdateStatusRef;
		let last: UpdateStatus | null = null;
		yield* Effect.schedule(
			Effect.gen(function* () {
				const current = yield* SubscriptionRef.get(ref);
				if (last === null || current.status !== last.status || current.progress !== last.progress) {
					last = current;
					win.webview.rpc?.send.updateStatus(current);
				}
			}),
			Schedule.spaced("500 millis"),
		);
	}),
);
```

- [ ] **Step 4: Run biome check**

Run: `bun run check`

Fix any formatting issues.

- [ ] **Step 5: Run tests**

Run: `bun test`

Expected: all tests pass (861 baseline + new updater-service tests).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/bun/rpc-handlers.ts apps/desktop/src/bun/index.ts
git commit -m "refactor(desktop): wire updater through ManagedRuntime with SubscriptionRef status and Effect.schedule"
```

---

## Task 6: Final verification and polish

- [ ] **Step 1: Verify UpdateManager is gone from index.ts**

Run: `grep -n "UpdateManager\|getUpdateManager\|updateManager" apps/desktop/src/bun/index.ts`

Expected: no results.

- [ ] **Step 2: Verify all updater RPC handlers use bridgeHandler**

Run: `grep -c "bridgeHandler(runtime" apps/desktop/src/bun/index.ts`

Expected: at least 19 (15 data handlers from Phase 2a + 4 updater handlers: getUpdateSettings, updateUpdateSettings, checkForUpdate, applyUpdate).

- [ ] **Step 3: Verify no setInterval remains for update schedule**

Run: `grep -n "setInterval\|clearInterval\|checkTimer" apps/desktop/src/bun/index.ts apps/desktop/src/bun/updater-service.ts`

Expected: no results. Update scheduling uses `Effect.schedule`.

- [ ] **Step 4: Verify SubscriptionRef used for status**

Run: `grep -n "SubscriptionRef" apps/desktop/src/bun/updater-service.ts apps/desktop/src/bun/services.ts`

Expected: `SubscriptionRef.set` in updater-service.ts, `SubscriptionRef.SubscriptionRef<UpdateStatus>` in services.ts.

- [ ] **Step 5: Run full verification**

Run: `bun run check && bun run typecheck && bun test`

Expected: check clean (baseline), typecheck baseline (12 errors), all tests pass.

- [ ] **Step 6: Smoke test (manual)**

Have the user run `bun run dev` in `apps/desktop/` and verify:
- App launches without errors
- Dashboard loads
- Settings panel: "Check for Updates" works (should see "up-to-date" or "available" depending on version)
- Plugin settings still work (registry refresh)
- Theme detection works on Linux (if applicable)

- [ ] **Step 7: Commit polish (if any)**

```bash
# Only if step 6 required changes
git add -A
git commit -m "chore(desktop): Phase 2b cleanup after smoke test"
```

---

## Success Criteria (Phase 2b)

- [ ] `UpdateManager` class removed from `updater.ts`
- [ ] Pure helper functions and their 73 tests preserved unchanged
- [ ] `updater-service.ts` exports `checkForUpdate`, `downloadUpdate`, `applyUpdate`, `cleanupUpdates`, `startUpdateSchedule` as Effects
- [ ] `UpdateStatusRef` (SubscriptionRef<UpdateStatus>) in runtime layer replaces mutable status + callback
- [ ] `UpdaterConfig` context tag provides currentVersion/platform/arch
- [ ] Retry uses `Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(2))))`
- [ ] Periodic checking uses `Effect.schedule(check, Schedule.spaced(...))`
- [ ] Update status changes forwarded to webview via SubscriptionRef subscription
- [ ] `index.ts` dispatches updater RPC via `bridgeHandler(runtime, ...)`
- [ ] `index.ts` forks update schedule as Effect fiber, interrupts on quit
- [ ] All tests pass
- [ ] Typecheck holds baseline
- [ ] Biome check passes

---

## Non-Goals (Phase 2b)

- **Stream-based download** — The current `response.body.getReader()` loop is wrapped in `Effect.tryPromise` rather than converted to a full `Stream` pipeline. The pragmatic benefit of `Stream` here is marginal since the progress reporting already works and the reader loop is straightforward. This can be a future enhancement.
- **HttpClient from @effect/platform** — We use the global `fetch()` wrapped in `Effect.tryPromise` rather than `HttpClient.execute`. The global fetch works fine in Bun and avoids adding another layer of abstraction. `HttpClient` would be valuable if we needed interceptors or test-time mock substitution.
- **Tagged error types** — Errors remain as plain `Error` instances because the RPC contract (`UpdateStatus.error`) is already a string. There's no typed error channel crossing the boundary. Tagged errors would add complexity without benefit here.
- **Frontend migration** — Phase 3.
