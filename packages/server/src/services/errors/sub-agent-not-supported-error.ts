import { Data } from "effect";

export class SubAgentNotSupportedError extends Data.TaggedError("SubAgentNotSupportedError")<{
	readonly pluginId: string;
}> {}
