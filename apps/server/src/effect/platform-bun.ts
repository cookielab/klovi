import { BunSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { BunContext } from "@effect/platform-bun";
import { Layer } from "effect";

export const BunPluginLayer = Layer.merge(BunContext.layer, BunSqliteLayer);
