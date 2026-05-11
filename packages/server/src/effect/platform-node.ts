import { createServer } from "node:http";
import { NodeSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";

type NodeServerLayer = ReturnType<
	typeof Layer.mergeAll<[ReturnType<typeof NodeHttpServer.layer>, typeof NodeContext.layer, typeof NodeSqliteLayer]>
>;

function makeNodeServerLayer(options: { host: string; port: number }): NodeServerLayer {
	return Layer.mergeAll(
		NodeHttpServer.layer(() => createServer(), options),
		NodeContext.layer,
		NodeSqliteLayer,
	);
}

const NodePluginLayer = Layer.merge(NodeContext.layer, NodeSqliteLayer);

export { makeNodeServerLayer, NodePluginLayer };
