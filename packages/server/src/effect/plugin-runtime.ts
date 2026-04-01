import type { PluginConfigShape, PluginRequirements, RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer } from "@cookielab.io/klovi-plugin-core";
import { Effect, type Layer, ManagedRuntime, type ManagedRuntime as ManagedRuntimeType } from "effect";
import { BunPluginLayer } from "./platform-bun.ts";

let pluginRuntime: ManagedRuntimeType.ManagedRuntime<RegistryRequirements, never> = ManagedRuntime.make(
	BunPluginLayer,
) as ManagedRuntimeType.ManagedRuntime<RegistryRequirements, never>;

export function setPluginLayer(layer: Layer.Layer<RegistryRequirements>): void {
	pluginRuntime = ManagedRuntime.make(layer) as ManagedRuntimeType.ManagedRuntime<RegistryRequirements, never>;
}

export function runPluginEffect<A, E>(
	effect: Effect.Effect<A, E, PluginRequirements>,
	config: PluginConfigShape,
): Promise<A> {
	const provided = effect.pipe(Effect.provide(makePluginConfigLayer(config)));
	return pluginRuntime.runPromise(provided);
}

export function runRegistryEffect<A>(effect: Effect.Effect<A, never, RegistryRequirements>): Promise<A> {
	return pluginRuntime.runPromise(effect);
}
