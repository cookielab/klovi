import { Data } from "effect";

export class RpcHandlerError extends Data.TaggedError("RpcHandlerError")<{
	readonly method: string;
	readonly reason: string;
}> {}
