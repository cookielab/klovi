import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_PLUGIN_ID_SET } from "./catalog.ts";
import { type SettingsWriteError, UnknownPluginError } from "./errors.ts";
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

function getUpdateSettings(settingsPath: string): Effect.Effect<UpdateSettingsInfo, never, FileSystem.FileSystem> {
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
