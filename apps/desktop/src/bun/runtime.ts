import { BunPluginLayer } from "@cookielab.io/klovi-server/effect/platform-bun";
import { createRegistry } from "@cookielab.io/klovi-server/services/auto-discover";
import { loadSettings } from "@cookielab.io/klovi-server/services/settings";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Effect, Layer, ManagedRuntime, Ref } from "effect";
import {
	AppDataDirRef,
	type DesktopServices,
	PlatformInfo,
	RegistryRef,
	SettingsPathRef,
	VersionState,
} from "./services.ts";

type DesktopRuntimeConfig = {
	versionInfo: VersionInfo;
	settingsPath: string;
	appDataDir: string;
	isLinux: boolean;
};

const makeRefsLayer = (
	config: DesktopRuntimeConfig,
): Layer.Layer<VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo, never, never> =>
	Layer.mergeAll(
		Layer.succeed(VersionState, { info: config.versionInfo }),
		Layer.succeed(SettingsPathRef, { path: config.settingsPath }),
		Layer.succeed(AppDataDirRef, { path: config.appDataDir }),
		Layer.succeed(PlatformInfo, { isLinux: config.isLinux }),
	);

const makeRegistryRefLayer = (settingsPath: string) =>
	Layer.effect(
		RegistryRef,
		Effect.gen(function* () {
			const settings = yield* loadSettings(settingsPath);
			const registry = yield* createRegistry(settings);
			return yield* Ref.make(registry);
		}),
	);

type DesktopRuntime = ManagedRuntime.ManagedRuntime<
	DesktopServices | Layer.Layer.Success<typeof BunPluginLayer>,
	never
>;

/**
 * Refresh the registry Ref from current settings on disk. Called by write
 * handlers (updatePluginSetting, resetSettings) after the write succeeds.
 */
const refreshRegistry = Effect.gen(function* () {
	const { path } = yield* SettingsPathRef;
	const registryRef = yield* RegistryRef;
	const settings = yield* loadSettings(path);
	const registry = yield* createRegistry(settings);
	yield* Ref.set(registryRef, registry);
});

/**
 * Bridge an Effect (with requirements drawn from the runtime) into an
 * Electrobun-compatible Promise handler.
 */
const bridgeHandler = <A, E>(
	runtime: DesktopRuntime,
	effect: Effect.Effect<A, E, DesktopServices | Layer.Layer.Success<typeof BunPluginLayer>>,
): Promise<A> => runtime.runPromise(effect);

export type { DesktopRuntime, DesktopRuntimeConfig };

export const makeDesktopRuntimeLayer = (config: DesktopRuntimeConfig) => {
	const refs = makeRefsLayer(config);
	const registryRef = makeRegistryRefLayer(config.settingsPath).pipe(Layer.provide(BunPluginLayer));
	return Layer.mergeAll(BunPluginLayer, refs, registryRef);
};

export const makeDesktopRuntime = (config: DesktopRuntimeConfig): DesktopRuntime =>
	ManagedRuntime.make(makeDesktopRuntimeLayer(config)) as DesktopRuntime;

export { bridgeHandler, refreshRegistry };
