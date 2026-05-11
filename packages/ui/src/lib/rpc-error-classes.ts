import { Data } from "effect";
import type { RpcHandlerError } from "./rpc-error-handler";

export class RpcTimeoutError extends Data.TaggedError("RpcTimeoutError")<{
	readonly method: string;
	readonly timeoutMs: number;
}> {}

export class RpcDisconnectedError extends Data.TaggedError("RpcDisconnectedError")<{
	readonly method: string;
}> {}

export type RpcError = RpcTimeoutError | RpcDisconnectedError | RpcHandlerError;
