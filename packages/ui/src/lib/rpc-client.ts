import { Effect } from "effect";
import type { KloviClient } from "./client.ts";
import type { KloviHostBridge } from "./host-bridge.ts";
import { mapToRpcError, type RpcError } from "./rpc-errors-effect.ts";
import { KloviClientService, KloviHostBridgeService } from "./runtime.ts";

type EffectfulKloviClient = {
	[K in keyof KloviClient]: (
		...args: Parameters<KloviClient[K]>
	) => Effect.Effect<Awaited<ReturnType<KloviClient[K]>>, RpcError, KloviClientService>;
};

type HostBridgeRequestMethod =
	| "applyUpdate"
	| "browseDirectory"
	| "checkForUpdate"
	| "getSystemTheme"
	| "getUpdateSettings"
	| "openExternal"
	| "updateUpdateSettings";

type EffectfulKloviHostBridge = {
	[K in HostBridgeRequestMethod]: (
		...args: Parameters<KloviHostBridge[K]>
	) => Effect.Effect<Awaited<ReturnType<KloviHostBridge[K]>>, RpcError, KloviHostBridgeService>;
};

function callClient<K extends keyof KloviClient>(
	method: K,
	...args: Parameters<KloviClient[K]>
): Effect.Effect<Awaited<ReturnType<KloviClient[K]>>, RpcError, KloviClientService> {
	return Effect.gen(function* () {
		const client = yield* KloviClientService;
		const fn = client[method] as (
			...callArgs: Parameters<KloviClient[K]>
		) => Promise<Awaited<ReturnType<KloviClient[K]>>>;
		return yield* Effect.tryPromise<Awaited<ReturnType<KloviClient[K]>>, RpcError>({
			try: () => fn(...args),
			catch: (error) => mapToRpcError(error, String(method)),
		});
	});
}

function callHostBridge<K extends HostBridgeRequestMethod>(
	method: K,
	...args: Parameters<KloviHostBridge[K]>
): Effect.Effect<Awaited<ReturnType<KloviHostBridge[K]>>, RpcError, KloviHostBridgeService> {
	return Effect.gen(function* () {
		const hostBridge = yield* KloviHostBridgeService;
		const fn = hostBridge[method] as (
			...callArgs: Parameters<KloviHostBridge[K]>
		) => Promise<Awaited<ReturnType<KloviHostBridge[K]>>>;
		return yield* Effect.tryPromise<Awaited<ReturnType<KloviHostBridge[K]>>, RpcError>({
			try: () => fn(...args),
			catch: (error) => mapToRpcError(error, String(method)),
		});
	});
}

export const kloviClient = {
	acceptRisks: () => callClient("acceptRisks"),
	getGeneralSettings: () => callClient("getGeneralSettings"),
	getPluginSettings: () => callClient("getPluginSettings"),
	getProjects: () => callClient("getProjects"),
	getSession: (params) => callClient("getSession", params),
	getSessions: (params) => callClient("getSessions", params),
	getStats: () => callClient("getStats"),
	getSubAgent: (params) => callClient("getSubAgent", params),
	getVersion: () => callClient("getVersion"),
	isFirstLaunch: () => callClient("isFirstLaunch"),
	resetSettings: () => callClient("resetSettings"),
	searchSessions: () => callClient("searchSessions"),
	updateGeneralSettings: (params) => callClient("updateGeneralSettings", params),
	updatePluginSetting: (params) => callClient("updatePluginSetting", params),
} satisfies EffectfulKloviClient;

export const kloviHostBridge = {
	applyUpdate: () => callHostBridge("applyUpdate"),
	browseDirectory: (params) => callHostBridge("browseDirectory", params),
	checkForUpdate: () => callHostBridge("checkForUpdate"),
	getSystemTheme: () => callHostBridge("getSystemTheme"),
	getUpdateSettings: () => callHostBridge("getUpdateSettings"),
	openExternal: (params) => callHostBridge("openExternal", params),
	updateUpdateSettings: (params) => callHostBridge("updateUpdateSettings", params),
} satisfies EffectfulKloviHostBridge;
