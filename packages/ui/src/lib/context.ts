import { createContext, createElement, useCallback, useContext, useEffect, useMemo } from "react";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { kloviClient } from "./rpc-client.ts";
import type { KloviClient } from "./client.ts";
import type { KloviHostBridge } from "./host-bridge.ts";
import { makeKloviUiRuntime, type KloviUiRuntime, type KloviUiServices } from "./runtime.ts";

type KloviRuntimeContextValue = {
	runtime: KloviUiRuntime;
	hostBridge: KloviHostBridge;
};

export const KloviRuntimeContext = createContext<KloviRuntimeContextValue | null>(null);

type KloviRuntimeProviderProps = {
	children?: ReactNode;
	client: KloviClient;
	hostBridge: KloviHostBridge;
};

export function KloviRuntimeProvider({ children, client, hostBridge }: KloviRuntimeProviderProps) {
	const runtime = useMemo(() => makeKloviUiRuntime({ client: client, hostBridge: hostBridge }), [client, hostBridge]);

	useEffect(() => {
		return () => {
			void runtime.dispose();
		};
	}, [runtime]);

	return createElement(KloviRuntimeContext.Provider, { value: { runtime: runtime, hostBridge: hostBridge } }, children);
}

export function useKloviRuntime(): KloviUiRuntime {
	const value = useContext(KloviRuntimeContext);
	if (!value) {
		throw new Error("useKloviRuntime must be used within a KloviRuntimeProvider");
	}
	return value.runtime;
}

export function useKloviClient() {
	return kloviClient;
}

export function useKloviHostBridge(): KloviHostBridge {
	const value = useContext(KloviRuntimeContext);
	if (!value) {
		throw new Error("useKloviHostBridge must be used within a KloviRuntimeProvider");
	}
	return value.hostBridge;
}

export function useRunKloviEffect() {
	const runtime = useKloviRuntime();

	return useCallback(
		async <A, E, R>(effect: Effect.Effect<A, E, R>) => {
			const result = await runtime.runPromise(
				Effect.either(effect as Effect.Effect<A, E, KloviUiServices>),
			);
			if (result._tag === "Left") {
				throw result.left;
			}
			return result.right;
		},
		[runtime],
	);
}
