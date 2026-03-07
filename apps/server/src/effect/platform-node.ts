import { NodeSqliteLayer } from "@cookielab.io/klovi-plugin-opencode";
import { NodeContext } from "@effect/platform-node";
import { Layer } from "effect";

export const NodePluginLayer = Layer.merge(NodeContext.layer, NodeSqliteLayer);
