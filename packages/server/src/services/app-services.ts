import type { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { runRegistryEffect } from "../effect/plugin-runtime.ts";
import { createRegistry as createRegistryEffect } from "./auto-discover.ts";
import type { PluginRegistry } from "./registry.ts";
import {
	getProjects as getProjectsEffect,
	getSession as getSessionEffect,
	getSessions as getSessionsEffect,
	getSubAgent as getSubAgentEffect,
	searchSessions as searchSessionsEffect,
} from "./sessions-service.ts";
import {
	deleteSettingsFile,
	getDefaultSettings,
	loadSettings as loadSettingsEffect,
	type PluginSettings,
	saveSettings as saveSettingsEffect,
	settingsFileExists,
	type UpdateChannel,
} from "./settings.ts";
import {
	getGeneralSettings as getGeneralSettingsEffect,
	getPluginSettings as getPluginSettingsEffect,
	getUpdateSettings as getUpdateSettingsEffect,
	type PluginSettingInfo,
	type UpdateSettingsInfo,
	updateGeneralSettings as updateGeneralSettingsEffect,
	updatePluginSetting as updatePluginSettingEffect,
	updateUpdateSettings as updateUpdateSettingsEffect,
} from "./settings-service.ts";
import { scanStats } from "./stats.ts";

function runSettingsEffect<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

function loadSettings(path: string): Promise<PluginSettings> {
	return Effect.runPromise(loadSettingsEffect(path).pipe(Effect.provide(BunContext.layer)));
}

function saveSettings(path: string, settings: PluginSettings): Promise<void> {
	return Effect.runPromise(saveSettingsEffect(path, settings).pipe(Effect.provide(BunContext.layer)));
}

function createRegistry(settings?: PluginSettings): Promise<PluginRegistry> {
	return runRegistryEffect(createRegistryEffect(settings));
}

type VersionInfo = {
	version: string;
	commit: string;
};

let _version = "dev";
let _commit = "";

function setVersion(version: string, commit: string): void {
	_version = version == null || version === "0.0.0" ? "dev" : version;
	_commit = commit ?? "";
}

function getVersion(): VersionInfo {
	return {
		version: _version,
		commit: _commit,
	};
}

async function getStats(registry: PluginRegistry) {
	const stats = await runRegistryEffect(scanStats(registry));
	return { stats: stats };
}

function getProjects(registry: PluginRegistry) {
	return runRegistryEffect(getProjectsEffect(registry));
}

function getSessions(registry: PluginRegistry, params: { encodedPath: string }) {
	return runRegistryEffect(getSessionsEffect(registry, params));
}

function getSession(registry: PluginRegistry, params: { sessionId: string; project: string }) {
	return runRegistryEffect(
		getSessionEffect(registry, params).pipe(
			Effect.catchTags({
				InvalidSessionIdError: () => Effect.die(new Error("Invalid sessionId format")),
				ProjectNotFoundError: () => Effect.die(new Error("Project not found")),
				PluginSourceNotFoundError: () => Effect.die(new Error("Plugin source not found")),
			}),
		),
	);
}

function getSubAgent(registry: PluginRegistry, params: { sessionId: string; project: string; agentId: string }) {
	return runRegistryEffect(
		getSubAgentEffect(registry, params).pipe(
			Effect.catchTags({
				InvalidSessionIdError: () => Effect.die(new Error("Invalid sessionId format")),
				UnknownPluginError: (e) => Effect.die(new Error(`Unknown plugin: ${e.pluginId}`)),
				SubAgentNotSupportedError: (e) =>
					Effect.die(new Error(`Sub-agent sessions are not supported by plugin: ${e.pluginId}`)),
			}),
		),
	);
}

function searchSessions(registry: PluginRegistry) {
	return runRegistryEffect(searchSessionsEffect(registry));
}

function getPluginSettings(settingsPath: string): Promise<{ plugins: PluginSettingInfo[] }> {
	return runSettingsEffect(getPluginSettingsEffect(settingsPath));
}

function getGeneralSettings(settingsPath: string): Promise<{ showSecurityWarning: boolean }> {
	return runSettingsEffect(getGeneralSettingsEffect(settingsPath));
}

async function isFirstLaunch(settingsPath: string): Promise<{ firstLaunch: boolean }> {
	const exists = await Effect.runPromise(settingsFileExists(settingsPath).pipe(Effect.provide(BunContext.layer)));
	return { firstLaunch: !exists };
}

async function completeOnboarding(settingsPath: string): Promise<{ ok: boolean }> {
	const { firstLaunch } = await isFirstLaunch(settingsPath);
	if (firstLaunch) {
		await saveSettings(settingsPath, getDefaultSettings());
	}
	return { ok: true };
}

async function resetSettings(settingsPath: string): Promise<{ ok: boolean }> {
	await Effect.runPromise(deleteSettingsFile(settingsPath).pipe(Effect.provide(BunContext.layer)));
	return { ok: true };
}

function updateGeneralSettings(
	settingsPath: string,
	params: { showSecurityWarning?: boolean },
): Promise<{ showSecurityWarning: boolean }> {
	return runSettingsEffect(
		updateGeneralSettingsEffect(settingsPath, params).pipe(
			Effect.catchTag("SettingsWriteError", (e) => Effect.die(e.cause)),
		),
	);
}

function updatePluginSetting(
	settingsPath: string,
	params: { pluginId: string; enabled?: boolean; dataDir?: string | null },
): Promise<{ plugins: PluginSettingInfo[] }> {
	return runSettingsEffect(
		updatePluginSettingEffect(settingsPath, params).pipe(
			Effect.catchTags({
				UnknownPluginError: (e) => Effect.die(new Error(`Unknown plugin: ${e.pluginId}`)),
				SettingsWriteError: (e) => Effect.die(e.cause),
			}),
		),
	);
}

function getUpdateSettings(settingsPath: string): Promise<UpdateSettingsInfo> {
	return runSettingsEffect(getUpdateSettingsEffect(settingsPath));
}

function updateUpdateSettings(
	settingsPath: string,
	params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
): Promise<UpdateSettingsInfo> {
	return runSettingsEffect(
		updateUpdateSettingsEffect(settingsPath, params).pipe(
			Effect.catchTag("SettingsWriteError", (e) => Effect.die(e.cause)),
		),
	);
}

export type { PluginSettingInfo, UpdateSettingsInfo } from "./settings-service.ts";
export type { VersionInfo };
export {
	completeOnboarding,
	createRegistry,
	getGeneralSettings,
	getPluginSettings,
	getProjects,
	getSession,
	getSessions,
	getStats,
	getSubAgent,
	getUpdateSettings,
	getVersion,
	isFirstLaunch,
	loadSettings,
	resetSettings,
	searchSessions,
	setVersion,
	updateGeneralSettings,
	updatePluginSetting,
	updateUpdateSettings,
};
