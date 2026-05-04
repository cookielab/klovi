import type {
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
	Turn,
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
import { completeOnboarding, isFirstLaunch, resetSettings } from "../services/onboarding-service.ts";
import type { MergedProject } from "../services/plugin-types.ts";
import type { PluginRegistry } from "../services/registry.ts";
import { getProjects, getSession, getSessionHead, getSessions, getSessionTail, getSubAgent, searchSessions } from "../services/sessions-service.ts";
import type { UpdateChannel } from "../services/settings.ts";
import { loadSettings } from "../services/settings.ts";
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
import { getStats, invalidateStatsCache, type StatsResponse } from "../services/stats-service.ts";
import { getVersion, makeVersionState, type VersionInfo } from "../services/version-service.ts";
import { ServerConfig } from "./server-config.ts";

export type KloviServicesShape = {
	readonly acceptRisks: () => Effect.Effect<{ ok: boolean }, SettingsWriteError, FileSystem.FileSystem>;
	readonly getVersion: () => Effect.Effect<VersionInfo>;
	readonly getStats: () => Effect.Effect<StatsResponse, never, RegistryRequirements>;
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
	readonly getSubAgent: (params: {
		sessionId: string;
		project: string;
		agentId: string;
	}) => Effect.Effect<
		{ session: Session },
		InvalidSessionIdError | UnknownPluginError | SubAgentNotSupportedError,
		RegistryRequirements
	>;
	readonly searchSessions: () => Effect.Effect<{ sessions: GlobalSessionResult[] }, never, RegistryRequirements>;
	readonly getPluginSettings: () => Effect.Effect<{ plugins: PluginSettingInfo[] }, never, FileSystem.FileSystem>;
	readonly updatePluginSetting: (params: {
		pluginId: string;
		enabled?: boolean;
		dataDir?: string | null;
	}) => Effect.Effect<{ plugins: PluginSettingInfo[] }, UnknownPluginError | SettingsWriteError, RegistryRequirements>;
	readonly getGeneralSettings: () => Effect.Effect<{ showSecurityWarning: boolean }, never, FileSystem.FileSystem>;
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
			getVersion: () => Effect.succeed(getVersion(versionState)),
			getStats: () => getStats(settingsPath, registry),
			getProjects: () => getProjects(registry),
			getSessions: (params) => getSessions(registry, params),
			getSession: (params) => getSession(registry, params),
			getSessionHead: (params) => getSessionHead(registry, params),
			getSessionTail: (params) => getSessionTail(registry, params),
			getSubAgent: (params) => getSubAgent(registry, params),
			searchSessions: () => searchSessions(registry),
			getPluginSettings: () => getPluginSettings(settingsPath),
			updatePluginSetting: (params) =>
				Effect.gen(function* () {
					const result = yield* updatePluginSetting(settingsPath, params);
					yield* refreshRegistry();
					yield* invalidateStatsCache(settingsPath);
					return result;
				}),
			getGeneralSettings: () => getGeneralSettings(settingsPath),
			updateGeneralSettings: (params) => updateGeneralSettings(settingsPath, params),
			isFirstLaunch: () => isFirstLaunch(settingsPath),
			resetSettings: () =>
				Effect.gen(function* () {
					const result = yield* resetSettings(settingsPath);
					yield* refreshRegistry();
					yield* invalidateStatsCache(settingsPath);
					return result;
				}),
			getUpdateSettings: () => getUpdateSettings(settingsPath),
			updateUpdateSettings: (params) => updateUpdateSettings(settingsPath, params),
			getRegistry: () => registry,
			settingsPath: settingsPath,
		};
	}),
);
