import { Data } from "effect";

export class PluginSourceNotFoundError extends Data.TaggedError("PluginSourceNotFoundError")<{
	readonly pluginId: string;
	readonly project: string;
}> {}
