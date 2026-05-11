import {
	completeOnboarding as completeOnboardingEffect,
	isFirstLaunch as isFirstLaunchEffect,
	resetSettings as resetSettingsEffect,
} from "@cookielab.io/klovi-server/services/onboarding-service";
import {
	getProjects as getProjectsEffect,
	getSession as getSessionEffect,
	getSessionHead as getSessionHeadEffect,
	getSessions as getSessionsEffect,
	getSessionTail as getSessionTailEffect,
	getSubAgent as getSubAgentEffect,
	searchSessions as searchSessionsEffect,
} from "@cookielab.io/klovi-server/services/sessions-service";
import {
	getGeneralSettings as getGeneralSettingsEffect,
	getPluginSettings as getPluginSettingsEffect,
	getUpdateSettings as getUpdateSettingsEffect,
	updateGeneralSettings as updateGeneralSettingsEffect,
	updatePluginSetting as updatePluginSettingEffect,
	updateUpdateSettings as updateUpdateSettingsEffect,
} from "@cookielab.io/klovi-server/services/settings-service";
import {
	getStats as getStatsEffect,
	invalidateStatsCache,
	refreshStats as refreshStatsEffect,
} from "@cookielab.io/klovi-server/services/stats-service";
import { getVersion } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Ref } from "effect";
import type { UpdateChannel } from "../shared/rpc-types";
import { refreshRegistry } from "./runtime";
import { RegistryRef, SettingsPathRef, VersionState } from "./services";
import { applyUpdate as applyUpdateEffect, checkForUpdate } from "./updater-service";

type Wrap<Effct, R> = Effct extends Effect.Effect<infer A, infer E, infer Req> ? Effect.Effect<A, E, Req | R> : never;

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
	const { path } = yield* SettingsPathRef;
	const registry = yield* currentRegistry;
	return yield* getStatsEffect(path, registry);
});

const refreshStatsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const registry = yield* currentRegistry;
	return yield* refreshStatsEffect(path, registry);
});

const getProjectsHandler = Effect.gen(function* () {
	const registry = yield* currentRegistry;
	return yield* getProjectsEffect(registry);
});

const getSessionsHandler = (params: { encodedPath: string }): Wrap<ReturnType<typeof getSessionsEffect>, RegistryRef> =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionsEffect(registry, params);
	});

const getSessionHandler = (params: {
	sessionId: string;
	project: string;
}): Wrap<ReturnType<typeof getSessionEffect>, RegistryRef> =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionEffect(registry, params);
	});

const getSessionHeadHandler = (params: {
	sessionId: string;
	project: string;
	headSize?: number;
}): Wrap<ReturnType<typeof getSessionHeadEffect>, RegistryRef> =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionHeadEffect(registry, params);
	});

const getSessionTailHandler = (params: {
	sessionId: string;
	project: string;
	fromTurn: number;
}): Wrap<ReturnType<typeof getSessionTailEffect>, RegistryRef> =>
	Effect.gen(function* () {
		const registry = yield* currentRegistry;
		return yield* getSessionTailEffect(registry, params);
	});

const getSubAgentHandler = (params: {
	sessionId: string;
	project: string;
	agentId: string;
}): Wrap<ReturnType<typeof getSubAgentEffect>, RegistryRef> =>
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

const updatePluginSettingHandler = (params: {
	pluginId: string;
	enabled?: boolean;
	dataDir?: string | null;
}): Wrap<
	ReturnType<typeof updatePluginSettingEffect>,
	| SettingsPathRef
	| RegistryRef
	| Effect.Effect.Context<typeof refreshRegistry>
	| Effect.Effect.Context<ReturnType<typeof invalidateStatsCache>>
> =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		const result = yield* updatePluginSettingEffect(path, params);
		yield* refreshRegistry;
		yield* invalidateStatsCache(path);
		return result;
	});

const getGeneralSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getGeneralSettingsEffect(path);
});

const updateGeneralSettingsHandler = (params: {
	showSecurityWarning?: boolean;
}): Wrap<ReturnType<typeof updateGeneralSettingsEffect>, SettingsPathRef> =>
	Effect.gen(function* () {
		const { path } = yield* SettingsPathRef;
		return yield* updateGeneralSettingsEffect(path, params);
	});

const resetSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const result = yield* resetSettingsEffect(path);
	yield* refreshRegistry;
	yield* invalidateStatsCache(path);
	return result;
});

// ---------- Update settings ----------

const getUpdateSettingsHandler = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	return yield* getUpdateSettingsEffect(path);
});

const updateUpdateSettingsHandler = (params: {
	channel?: UpdateChannel;
	checkIntervalHours?: number;
	autoDownload?: boolean;
}): Wrap<ReturnType<typeof updateUpdateSettingsEffect>, SettingsPathRef> =>
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

export {
	acceptRisksHandler,
	applyUpdateHandler,
	checkForUpdateHandler,
	getGeneralSettingsHandler,
	getPluginSettingsHandler,
	getProjectsHandler,
	getSessionHandler,
	getSessionHeadHandler,
	getSessionsHandler,
	getSessionTailHandler,
	getStatsHandler,
	getSubAgentHandler,
	getUpdateSettingsHandler,
	getVersionHandler,
	isFirstLaunchHandler,
	refreshStatsHandler,
	resetSettingsHandler,
	searchSessionsHandler,
	updateGeneralSettingsHandler,
	updatePluginSettingHandler,
	updateUpdateSettingsHandler,
};
