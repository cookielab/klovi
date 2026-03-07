import type { FileSystem } from "@effect/platform";
import { Layer } from "effect";
import { PluginConfig, type PluginConfigShape } from "./plugin-config.ts";
import type { SqliteClientTag } from "./sqlite-service.ts";

export type PluginRequirements = PluginConfig | FileSystem.FileSystem | SqliteClientTag;

/** Requirements for registry-level effects (PluginConfig is provided internally by the registry). */
export type RegistryRequirements = FileSystem.FileSystem | SqliteClientTag;

export function makePluginConfigLayer(config: PluginConfigShape): Layer.Layer<PluginConfig> {
  return Layer.succeed(PluginConfig, config);
}
