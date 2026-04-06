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

const acceptRisksHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	yield* completeOnboardingEffect(path);
	return { ok: true as const };
});

const isFirstLaunchHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* isFirstLaunchEffect(path);
});

const getVersionHandler = Effect.gen(function* () {
	const { info } = yield* VersionState;
	return getVersion(info);
});

// ---------- Registry-backed reads ----------

const currentRegistry = Effect.gen(function* () {
	const ref = yield* RegistryRef;
	return yield* Ref.get(ref);
});

const getStatsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* getStatsEffect(registry);
});

const getProjectsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* getProjectsEffect(registry);
});

const getSessionsHandler = (params: { encodedPath: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionsEffect(registry, params);
	});

const getSessionHandler = (params: { sessionId: string; project: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionEffect(registry, params);
	});

const getSubAgentHandler = (params: { sessionId: string; project: string; agentId: string }) =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSubAgentEffect(registry, params);
	});

const searchSessionsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* searchSessionsEffect(registry);
});

// ---------- Settings ----------

const getPluginSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getPluginSettingsEffect(path);
});

const updatePluginSettingHandler = (params: { pluginId: string; enabled?: boolean; dataDir?: string | null }) =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		const result = yield* updatePluginSettingEffect(path, params);
		yield* refreshRegistry;
		return result;
	});

const getGeneralSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getGeneralSettingsEffect(path);
});

const updateGeneralSettingsHandler = (params: { showSecurityWarning?: boolean }) =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		return yield* updateGeneralSettingsEffect(path, params);
	});

const resetSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const result = yield* resetSettingsEffect(path);
	yield* refreshRegistry;
	return result;
});

export {
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
};
