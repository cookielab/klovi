import type { KloviClient } from "./client.ts";

async function rpcCall<T>(baseUrl: string, method: string, params?: unknown): Promise<T> {
	const response = await fetch(`${baseUrl}/api/rpc/${method}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params ?? {}),
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as { error?: string };
		throw new Error(body.error ?? `RPC call failed: ${method} (${response.status})`);
	}

	return response.json() as Promise<T>;
}

export function createHttpClient(baseUrl: string): KloviClient {
	return {
		acceptRisks: () => rpcCall(baseUrl, "acceptRisks"),
		isFirstLaunch: () => rpcCall(baseUrl, "isFirstLaunch"),
		getVersion: () => rpcCall(baseUrl, "getVersion"),
		getStats: () => rpcCall(baseUrl, "getStats"),
		getProjects: () => rpcCall(baseUrl, "getProjects"),
		getSessions: (params) => rpcCall(baseUrl, "getSessions", params),
		getSession: (params) => rpcCall(baseUrl, "getSession", params),
		getSubAgent: (params) => rpcCall(baseUrl, "getSubAgent", params),
		searchSessions: () => rpcCall(baseUrl, "searchSessions"),
		getPluginSettings: () => rpcCall(baseUrl, "getPluginSettings"),
		updatePluginSetting: (params) => rpcCall(baseUrl, "updatePluginSetting", params),
		getGeneralSettings: () => rpcCall(baseUrl, "getGeneralSettings"),
		updateGeneralSettings: (params) => rpcCall(baseUrl, "updateGeneralSettings", params),
		resetSettings: () => rpcCall(baseUrl, "resetSettings"),
	};
}
