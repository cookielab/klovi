import { BunSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { BunContext, BunHttpServer } from "@effect/platform-bun";
import { Layer } from "effect";

export const BunPluginLayer = Layer.merge(BunContext.layer, BunSqliteLayer);

export const makeBunServerLayer = (options: { hostname: string; port: number }) =>
	Layer.mergeAll(BunHttpServer.layer(options), BunContext.layer, BunSqliteLayer);
