import { Data } from "effect";

export class PluginError extends Data.TaggedError("PluginError")<{
	readonly pluginId: string;
	readonly operation: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}
