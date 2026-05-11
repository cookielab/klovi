import { Data } from "effect";

export class InvalidSessionIdError extends Data.TaggedError("InvalidSessionIdError")<{
	readonly value: string;
}> {}
