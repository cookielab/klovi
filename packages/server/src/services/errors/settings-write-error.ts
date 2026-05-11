import { Data } from "effect";

export class SettingsWriteError extends Data.TaggedError("SettingsWriteError")<{
	readonly path: string;
	readonly cause: unknown;
}> {}
