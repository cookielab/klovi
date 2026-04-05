import { Data } from "effect";

export class InvalidSessionIdError extends Data.TaggedError("InvalidSessionIdError")<{
	readonly value: string;
}> {}

export class ProjectNotFoundError extends Data.TaggedError("ProjectNotFoundError")<{
	readonly encodedPath: string;
}> {}

export class PluginSourceNotFoundError extends Data.TaggedError("PluginSourceNotFoundError")<{
	readonly pluginId: string;
	readonly project: string;
}> {}

export class UnknownPluginError extends Data.TaggedError("UnknownPluginError")<{
	readonly pluginId: string;
}> {}

export class SubAgentNotSupportedError extends Data.TaggedError("SubAgentNotSupportedError")<{
	readonly pluginId: string;
}> {}

export class SettingsWriteError extends Data.TaggedError("SettingsWriteError")<{
	readonly path: string;
	readonly cause: unknown;
}> {}
