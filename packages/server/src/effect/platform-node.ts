import { createServer } from "node:http";
import { NodeSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";

export const NodePluginLayer = Layer.merge(NodeContext.layer, NodeSqliteLayer);

export const makeNodeServerLayer = (options: { host: string; port: number }) =>
	Layer.mergeAll(
		NodeHttpServer.layer(() => createServer(), options),
		NodeContext.layer,
		NodeSqliteLayer,
	);
