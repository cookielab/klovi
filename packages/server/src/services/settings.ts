import { dirname, join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { BUILTIN_PLUGIN_DESCRIPTORS } from "./catalog";
import { SettingsWriteError } from "./errors";

const N_6 = 6;

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
	return Object.fromEntries(
		BUILTIN_PLUGIN_DESCRIPTORS.map(({ plugin, defaultEnabled }) => [
			plugin.id,
			{ enabled: defaultEnabled, dataDir: null },
		]),
	);
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
			checkIntervalHours: N_6,
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
		yield* fs
			.makeDirectory(dir, { recursive: true })
			.pipe(Effect.mapError((cause) => new SettingsWriteError({ path: path, cause: cause })));
		const tmpPath = join(dir, `.settings-${Date.now()}.tmp`);
		yield* fs
			.writeFileString(tmpPath, JSON.stringify(settings, null, 2))
			.pipe(Effect.mapError((cause) => new SettingsWriteError({ path: path, cause: cause })));
		yield* fs
			.rename(tmpPath, path)
			.pipe(Effect.mapError((cause) => new SettingsWriteError({ path: path, cause: cause })));
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
