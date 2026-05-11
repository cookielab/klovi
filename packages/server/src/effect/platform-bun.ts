import { BunSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { BunContext, BunHttpServer } from "@effect/platform-bun";
import { Layer } from "effect";

type BunServerLayer = ReturnType<
	typeof Layer.mergeAll<[ReturnType<typeof BunHttpServer.layer>, typeof BunContext.layer, typeof BunSqliteLayer]>
>;

function makeBunServerLayer(options: { hostname: string; port: number }): BunServerLayer {
	return Layer.mergeAll(BunHttpServer.layer(options), BunContext.layer, BunSqliteLayer);
}

const BunPluginLayer = Layer.merge(BunContext.layer, BunSqliteLayer);

export { BunPluginLayer, makeBunServerLayer };
