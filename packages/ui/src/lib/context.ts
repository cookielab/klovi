import { Effect } from "effect";
import type { ReactNode } from "react";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo } from "react";
import type { KloviClient } from "./client";
import type { KloviHostBridge } from "./host-bridge";
import { kloviClient } from "./rpc-client";
import { type KloviUiRuntime, type KloviUiServices, makeKloviUiRuntime } from "./runtime";

type KloviRuntimeContextValue = {
	runtime: KloviUiRuntime;
	hostBridge: KloviHostBridge;
};

type KloviRuntimeProviderProps = {
	children?: ReactNode;
	client: KloviClient;
	hostBridge: KloviHostBridge;
};

export const KloviRuntimeContext = createContext<KloviRuntimeContextValue | null>(null);

export function KloviRuntimeProvider({ children, client, hostBridge }: KloviRuntimeProviderProps): ReactNode {
	const runtime = useMemo(() => makeKloviUiRuntime({ client: client, hostBridge: hostBridge }), [client, hostBridge]);

	useEffect(
		() => () => {
			runtime.dispose();
		},
		[runtime],
	);

	return createElement(KloviRuntimeContext.Provider, { value: { runtime: runtime, hostBridge: hostBridge } }, children);
}

export function useKloviRuntime(): KloviUiRuntime {
	const value = useContext(KloviRuntimeContext);
	if (!value) {
		throw new Error("useKloviRuntime must be used within a KloviRuntimeProvider");
	}
	return value.runtime;
}

export function useKloviClient(): typeof kloviClient {
	return kloviClient;
}

export function useKloviHostBridge(): KloviHostBridge {
	const value = useContext(KloviRuntimeContext);
	if (!value) {
		throw new Error("useKloviHostBridge must be used within a KloviRuntimeProvider");
	}
	return value.hostBridge;
}

export function useRunKloviEffect(): <A, E, R>(effect: Effect.Effect<A, E, R>) => Promise<A> {
	const runtime = useKloviRuntime();

	return useCallback(
		async <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> => {
			const result = await runtime.runPromise(Effect.either(effect as Effect.Effect<A, E, KloviUiServices>));
			if (result._tag === "Left") {
				throw result.left;
			}
			return result.right;
		},
		[runtime],
	);
}
