import { Data } from "effect";

export class ProjectNotFoundError extends Data.TaggedError("ProjectNotFoundError")<{
	readonly encodedPath: string;
}> {}
