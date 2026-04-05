import type { DashboardStats, GlobalSessionResult, Session, SessionSummary } from "@cookielab.io/klovi-plugin-core";
import { BunContext } from "@effect/platform-bun";
import { Context, Effect, Layer } from "effect";
import {
	completeOnboarding,
	getGeneralSettings,
	getPluginSettings,
	getProjects,
	getSession,
	getSessions,
	getStats,
	getSubAgent,
	getUpdateSettings,
	isFirstLaunch,
	type PluginSettingInfo,
	resetSettings,
	searchSessions,
	type UpdateSettingsInfo,
	updateGeneralSettings,
	updatePluginSetting,
	updateUpdateSettings,
	type VersionInfo,
} from "../services/app-services.ts";
import { createRegistry } from "../services/auto-discover.ts";
import type { MergedProject } from "../services/plugin-types.ts";
import type { PluginRegistry } from "../services/registry.ts";
import type { UpdateChannel } from "../services/settings.ts";
import { loadSettings } from "../services/settings.ts";
import { ServerConfig } from "./server-config.ts";

export type KloviServicesShape = {
	readonly acceptRisks: () => Promise<{ ok: boolean }>;
	readonly getVersion: () => VersionInfo;
	readonly getStats: () => Promise<{ stats: DashboardStats }>;
	readonly getProjects: () => Promise<{ projects: MergedProject[] }>;
	readonly getSessions: (params: { encodedPath: string }) => Promise<{ sessions: SessionSummary[] }>;
	readonly getSession: (params: { sessionId: string; project: string }) => Promise<{ session: Session }>;
	readonly getSubAgent: (params: {
		sessionId: string;
		project: string;
		agentId: string;
	}) => Promise<{ session: Session }>;
	readonly searchSessions: () => Promise<{ sessions: GlobalSessionResult[] }>;
	readonly getPluginSettings: () => Promise<{ plugins: PluginSettingInfo[] }>;
	readonly updatePluginSetting: (params: {
		pluginId: string;
		enabled?: boolean;
		dataDir?: string | null;
	}) => Promise<{ plugins: PluginSettingInfo[] }>;
	readonly getGeneralSettings: () => Promise<{ showSecurityWarning: boolean }>;
	readonly updateGeneralSettings: (params: {
		showSecurityWarning?: boolean;
	}) => Promise<{ showSecurityWarning: boolean }>;
	readonly isFirstLaunch: () => Promise<{ firstLaunch: boolean }>;
	readonly resetSettings: () => Promise<{ ok: boolean }>;
	readonly getUpdateSettings: () => Promise<UpdateSettingsInfo>;
	readonly updateUpdateSettings: (params: {
		channel?: UpdateChannel;
		checkIntervalHours?: number;
		autoDownload?: boolean;
	}) => Promise<UpdateSettingsInfo>;
	readonly getRegistry: () => PluginRegistry;
	readonly settingsPath: string;
};

export class KloviServices extends Context.Tag("@klovi/KloviServices")<KloviServices, KloviServicesShape>() {}

export const KloviServicesLive = Layer.effect(
	KloviServices,
	Effect.gen(function* () {
		const config = yield* ServerConfig;
		const { settingsPath } = config;
		const version = config.version === "0.0.0" ? "dev" : config.version;
		const settings = yield* loadSettings(settingsPath).pipe(Effect.provide(BunContext.layer));
		let registry: PluginRegistry = yield* Effect.promise(() => createRegistry(settings));

		const refreshRegistry = (): Effect.Effect<void, never, never> =>
			Effect.gen(function* () {
				const freshSettings = yield* loadSettings(settingsPath).pipe(Effect.provide(BunContext.layer));
				registry = yield* Effect.promise(() => createRegistry(freshSettings));
			});

		return {
			acceptRisks: () => completeOnboarding(settingsPath),
			getVersion: () => ({ version: version, commit: config.commit }),
			getStats: () => getStats(registry),
			getProjects: () => getProjects(registry),
			getSessions: (params) => getSessions(registry, params),
			getSession: (params) => getSession(registry, params),
			getSubAgent: (params) => getSubAgent(registry, params),
			searchSessions: () => searchSessions(registry),
			getPluginSettings: () => getPluginSettings(settingsPath),
			updatePluginSetting: async (params) => {
				const result = await updatePluginSetting(settingsPath, params);
				await Effect.runPromise(refreshRegistry());
				return result;
			},
			getGeneralSettings: () => getGeneralSettings(settingsPath),
			updateGeneralSettings: (params) => updateGeneralSettings(settingsPath, params),
			isFirstLaunch: () => isFirstLaunch(settingsPath),
			resetSettings: async () => {
				const result = await resetSettings(settingsPath);
				await Effect.runPromise(refreshRegistry());
				return result;
			},
			getUpdateSettings: () => getUpdateSettings(settingsPath),
			updateUpdateSettings: (params) => updateUpdateSettings(settingsPath, params),
			getRegistry: () => registry,
			settingsPath: settingsPath,
		};
	}),
);
