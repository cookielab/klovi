import { Effect } from "effect";
import type { KloviClient } from "./client";
import type { KloviHostBridge } from "./host-bridge";
import { mapToRpcError, type RpcError } from "./rpc-errors-effect";
import { KloviClientService, KloviHostBridgeService } from "./runtime";

type EffectfulKloviClient = {
	[K in keyof KloviClient]: (
		...args: Parameters<KloviClient[K]>
	) => Effect.Effect<Awaited<ReturnType<KloviClient[K]>>, RpcError, KloviClientService>;
};

type ClientMethod<K extends keyof KloviClient> = (
	...args: Parameters<KloviClient[K]>
) => Promise<Awaited<ReturnType<KloviClient[K]>>>;

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

type HostBridgeMethod<K extends HostBridgeRequestMethod> = (
	...args: Parameters<KloviHostBridge[K]>
) => Promise<Awaited<ReturnType<KloviHostBridge[K]>>>;

function callClient<K extends keyof KloviClient>(
	method: K,
	...args: Parameters<KloviClient[K]>
): Effect.Effect<Awaited<ReturnType<KloviClient[K]>>, RpcError, KloviClientService> {
	return Effect.gen(function* () {
		const client = yield* KloviClientService;
		const fn = client[method] as unknown as ClientMethod<K>;
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
		const fn = hostBridge[method] as unknown as HostBridgeMethod<K>;
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
	getSessionHead: (params) => callClient("getSessionHead", params),
	getSessions: (params) => callClient("getSessions", params),
	getSessionTail: (params) => callClient("getSessionTail", params),
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
