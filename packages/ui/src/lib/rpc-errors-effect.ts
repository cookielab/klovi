import { Data } from "effect";
import { getRpcErrorCode } from "./rpc-errors.ts";

const TIMEOUT_MS_REGEX = /exceeded (?<ms>\d+)ms/u;
const TIMEOUT_METHOD_REGEX = /\((?<method>\w+) exceeded/u;
const DISCONNECT_METHOD_REGEX = /during (?<method>\w+)/u;

export class RpcTimeoutError extends Data.TaggedError("RpcTimeoutError")<{
	readonly method: string;
	readonly timeoutMs: number;
}> {}

export class RpcDisconnectedError extends Data.TaggedError("RpcDisconnectedError")<{
	readonly method: string;
}> {}

export class RpcHandlerError extends Data.TaggedError("RpcHandlerError")<{
	readonly method: string;
	readonly reason: string;
}> {}

export type RpcError = RpcTimeoutError | RpcDisconnectedError | RpcHandlerError;

export function mapToRpcError(error: unknown): RpcError {
	const code = getRpcErrorCode(error);
	if (code === "rpc-timeout") {
		const msg = error instanceof Error ? error.message : String(error);
		const timeoutMatch = TIMEOUT_MS_REGEX.exec(msg);
		const timeoutMs = timeoutMatch?.groups?.["ms"] ? Number(timeoutMatch.groups["ms"]) : 0;
		const methodMatch = TIMEOUT_METHOD_REGEX.exec(msg);
		const method = methodMatch?.groups?.["method"] ?? "unknown";
		return new RpcTimeoutError({ method: method, timeoutMs: timeoutMs });
	}
	if (code === "rpc-disconnected") {
		const msg = error instanceof Error ? error.message : String(error);
		const methodMatch = DISCONNECT_METHOD_REGEX.exec(msg);
		const method = methodMatch?.groups?.["method"] ?? "unknown";
		return new RpcDisconnectedError({ method: method });
	}
	const message = error instanceof Error ? error.message : String(error);
	return new RpcHandlerError({ method: "unknown", reason: message });
}
