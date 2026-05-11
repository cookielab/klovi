import { Context, Layer, ManagedRuntime } from "effect";
import type { KloviClient } from "./client";
import type { KloviHostBridge } from "./host-bridge";

export class KloviClientService extends Context.Tag("@klovi/ui/KloviClient")<KloviClientService, KloviClient>() {}

export class KloviHostBridgeService extends Context.Tag("@klovi/ui/KloviHostBridge")<
	KloviHostBridgeService,
	KloviHostBridge
>() {}

export type KloviUiServices = KloviClientService | KloviHostBridgeService;

export type KloviUiRuntimeConfig = {
	client: KloviClient;
	hostBridge: KloviHostBridge;
};

export type KloviUiRuntime = ManagedRuntime.ManagedRuntime<KloviUiServices, never>;

export const makeKloviUiLayer = (config: KloviUiRuntimeConfig): Layer.Layer<KloviUiServices, never, never> =>
	Layer.mergeAll(
		Layer.succeed(KloviClientService, config.client),
		Layer.succeed(KloviHostBridgeService, config.hostBridge),
	);

export const makeKloviUiRuntime = (config: KloviUiRuntimeConfig): KloviUiRuntime =>
	ManagedRuntime.make(makeKloviUiLayer(config)) as KloviUiRuntime;
