import { Context } from "effect";

export type PluginConfigShape = {
	readonly dataDir: string;
};

export class PluginConfig extends Context.Tag("@klovi/PluginConfig")<PluginConfig, PluginConfigShape>() {}
