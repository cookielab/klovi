import type {
  PluginConfigShape,
  PluginRequirements,
  RegistryRequirements,
} from "@cookielab.io/klovi-plugin-core";
import { makePluginConfigLayer } from "@cookielab.io/klovi-plugin-core";
import { Effect, ManagedRuntime } from "effect";
import { BunPluginLayer } from "./platform-bun.ts";

const pluginRuntime = ManagedRuntime.make(BunPluginLayer);

export function runPluginEffect<A, E>(
  effect: Effect.Effect<A, E, PluginRequirements>,
  config: PluginConfigShape,
): Promise<A> {
  const provided = effect.pipe(Effect.provide(makePluginConfigLayer(config)));
  return pluginRuntime.runPromise(provided);
}

export function runRegistryEffect<A>(
  effect: Effect.Effect<A, never, RegistryRequirements>,
): Promise<A> {
  return pluginRuntime.runPromise(effect);
}
