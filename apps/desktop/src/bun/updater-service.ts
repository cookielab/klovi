import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { getUpdateSettings } from "@cookielab.io/klovi-server/services/settings-service";
import { Duration, Effect, Schedule, SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types";
import { AppDataDirRef, SettingsPathRef, UpdaterConfig, UpdateStatusRef } from "./services";
import {
	findLatestUsableRelease,
	findReleaseAsset,
	type GithubRelease,
	getReleaseBundleAssetName,
	getUpdateJsonAssetName,
	getZstdBinaryPath,
	isValidUpdateInfo,
	validateExtractedBundle,
	validateUpdateInfo,
} from "./updater";


const N_500000 = 500_000;
const N_100 = 100;
const N_10 = 10;

type Platform = "macos" | "linux" | "win";

const GITHUB_API_URL = "https://api.github.com/repos/cookielab/klovi/releases";
const ZSTD_SUFFIX_RE = /\.zst$/u;
const MINUTES_PER_THROTTLE = 5;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const CHECK_THROTTLE_MS = MINUTES_PER_THROTTLE * SECONDS_PER_MINUTE * MS_PER_SECOND;

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
		return (await response.json()) as GithubRelease[];
	},
	catch: (error) => new Error(error instanceof Error ? error.message : "Failed to fetch releases"),
});

type StreamState = {
	reader: ReadableStreamDefaultReader<Uint8Array>;
	writer: ReturnType<ReturnType<typeof Bun.file>["writer"]>;
	totalBytes: number | undefined;
	version: string;
	currentVersion: string;
};

const streamChunksToFile = (state: StreamState) =>
	Effect.gen(function* () {
		let bytesDownloaded = 0;
		const { reader, writer, totalBytes, version, currentVersion } = state;

		while (true) {
			const { done, value } = yield* Effect.tryPromise({
				try: () => reader.read(),
				catch: () => new Error("Stream read failed"),
			});
			if (done) {
				break;
			}
			yield* Effect.tryPromise({
				try: () => Promise.resolve(writer.write(value)),
				catch: () => new Error("File write failed"),
			});
			bytesDownloaded += value.length;

			const progressReportIntervalBytes = N_500000;
			const percentageMultiplier = N_100;
			if (bytesDownloaded % progressReportIntervalBytes < value.length) {
				const status: UpdateStatus = { status: "downloading", currentVersion: currentVersion, latestVersion: version };
				if (totalBytes) {
					status.progress = Math.round((bytesDownloaded / totalBytes) * percentageMultiplier);
				}
				yield* emitStatus(status);
			}
		}
		return bytesDownloaded;
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
		const totalBytes = contentLength ? Number.parseInt(contentLength, N_10) : undefined;
		const reader = response.body.getReader();
		const writer = Bun.file(destPath).writer();

		const bytesDownloaded = yield* streamChunksToFile({
			reader: reader,
			writer: writer,
			totalBytes: totalBytes,
			version: version,
			currentVersion: config.currentVersion,
		});

		yield* Effect.tryPromise({
			try: () => Promise.resolve(writer.flush()),
			catch: () => new Error("Flush failed"),
		});
		writer.end();

		if (totalBytes && bytesDownloaded !== totalBytes) {
			yield* Effect.tryPromise({
				try: () => rm(destPath).catch(() => undefined),
				catch: () => new Error("Cleanup failed"),
			});
			return yield* Effect.fail(
				new Error(`Download size mismatch: expected ${totalBytes} bytes, got ${bytesDownloaded}`),
			);
		}
	});

const fetchWithRetry = (url: string, destPath: string, version: string) =>
	fetchAndSave(url, destPath, version).pipe(
		Effect.retry(Schedule.exponential(Duration.seconds(1)).pipe(Schedule.compose(Schedule.recurs(2)))),
		Effect.tapError(() =>
			Effect.sync(() => {
				rm(destPath).catch(() => undefined);
			}),
		),
	);

// ────── Mutable state shared across check/download/apply ──────
let lastCheckTimestamp = 0;
let latestRelease: GithubRelease | null = null;
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

const decompressBundle = (platform: Platform, compressedPath: string, tarPath: string) =>
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
			try: () => rm(tarPath).catch(() => undefined),
			catch: () => new Error("Pre-decompress cleanup failed"),
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
	const archivePath = downloadedAssetPath;

	const config = yield* UpdaterConfig;
	const { path: appDataDir } = yield* AppDataDirRef;
	const updatesDir = join(appDataDir, "updates");
	const stagingDir = join(updatesDir, "staging");

	yield* Effect.tryPromise({
		try: () => mkdir(stagingDir, { recursive: true }),
		catch: () => new Error("Failed to create staging directory"),
	});

	const applyPipeline = Effect.gen(function* () {
		const archiveBytes = yield* Effect.tryPromise({
			try: () => Bun.file(archivePath).arrayBuffer(),
			catch: () => new Error("Failed to read update archive"),
		});
		const archive = new Bun.Archive(archiveBytes);
		yield* Effect.tryPromise({
			try: () => archive.extract(stagingDir),
			catch: () => new Error("Failed to extract update archive"),
		});

		if (config.platform === "macos") {
			yield* applyMacOs(stagingDir, updatesDir);
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

const applyMacOs = (stagingDir: string, updatesDir: string) =>
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
			yield* Effect.tryPromise({
				try: () => rename(backupPath, runningAppPath),
				catch: () => new Error("Rollback failed"),
			}).pipe(Effect.ignore);
			return yield* Effect.fail(replaceResult.left);
		}

		yield* Effect.tryPromise({
			try: () => rm(backupPath, { recursive: true }),
			catch: () => new Error("Backup cleanup failed"),
		}).pipe(Effect.ignore);

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

		const { pid } = process;
		Bun.spawn(["sh", "-c", `while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done; sleep 1; open "${runningAppPath}"`], {
			detached: true,
			stdio: ["ignore", "ignore", "ignore"],
		} as Parameters<typeof Bun.spawn>[1]);

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

		const { pid } = process;
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
					[
						"schtasks",
						"/create",
						"/tn",
						taskName,
						"/tr",
						`cmd /c "${scriptPathWin}"`,
						"/sc",
						"once",
						"/st",
						"00:00",
						"/f",
					],
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
			await Promise.all(entries.map((entry) => rm(join(dir, entry), { recursive: true }).catch(() => undefined)));
		},
		catch: () => new Error("Cleanup failed"),
	}).pipe(Effect.ignore);
});

// ────── Scheduled checking ──────

const startUpdateSchedule = (immediateCheck: boolean) =>
	Effect.gen(function* () {
		const { path: settingsPath } = yield* SettingsPathRef;
		const settings = yield* getUpdateSettings(settingsPath);
		const intervalMs = settings.checkIntervalHours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

		if (immediateCheck) {
			yield* checkForUpdate.pipe(Effect.ignore);
		}

		yield* Effect.schedule(checkForUpdate.pipe(Effect.ignore), Schedule.spaced(Duration.millis(intervalMs)));
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
