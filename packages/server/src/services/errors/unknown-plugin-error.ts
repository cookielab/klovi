import { Data } from "effect";

export class UnknownPluginError extends Data.TaggedError("UnknownPluginError")<{
	readonly pluginId: string;
}> {}
