import { Data } from "effect";
import { getRpcErrorCode } from "./rpc-errors.ts";

const TIMEOUT_MS_REGEX = /exceeded (?<ms>\d+)ms/u;
const TIMEOUT_METHOD_REGEX = /\((?<method>\w+) exceeded/u;
const DISCONNECT_METHOD_REGEX = /during (?<method>\w+)/u;

type RpcTag = "RpcTimeoutError" | "RpcDisconnectedError" | "RpcHandlerError";

function hasRpcTag(error: unknown): error is { _tag: RpcTag } {
	if (!(typeof error === "object" && error !== null && "_tag" in error)) {
		return false;
	}

	return error._tag === "RpcTimeoutError" || error._tag === "RpcDisconnectedError" || error._tag === "RpcHandlerError";
}

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

export function isRpcError(error: unknown): error is RpcError {
	return hasRpcTag(error);
}

export function isTransportRpcError(error: unknown): error is RpcTimeoutError | RpcDisconnectedError {
	return typeof error === "object" && error !== null && "_tag" in error
		? error._tag === "RpcTimeoutError" || error._tag === "RpcDisconnectedError"
		: false;
}

export function getRpcErrorMessage(error: RpcError): string {
	switch (error._tag) {
		case "RpcTimeoutError":
			return error.timeoutMs > 0
				? `Request timed out during ${error.method} after ${error.timeoutMs}ms`
				: `Request timed out during ${error.method}`;
		case "RpcDisconnectedError":
			return `Desktop host disconnected during ${error.method}`;
		case "RpcHandlerError":
			return error.reason;
		default:
			break;
	}
	return "Unknown RPC error";
}

export function mapToRpcError(error: unknown, fallbackMethod = "unknown"): RpcError {
	if (isRpcError(error)) {
		return error;
	}

	const code = getRpcErrorCode(error);
	if (code === "rpc-timeout") {
		const msg = error instanceof Error ? error.message : String(error);
		const timeoutMatch = TIMEOUT_MS_REGEX.exec(msg);
		const timeoutMs = timeoutMatch?.groups?.["ms"] ? Number(timeoutMatch.groups["ms"]) : 0;
		const methodMatch = TIMEOUT_METHOD_REGEX.exec(msg);
		const method = methodMatch?.groups?.["method"] ?? fallbackMethod;
		return new RpcTimeoutError({ method: method, timeoutMs: timeoutMs });
	}
	if (code === "rpc-disconnected") {
		const msg = error instanceof Error ? error.message : String(error);
		const methodMatch = DISCONNECT_METHOD_REGEX.exec(msg);
		const method = methodMatch?.groups?.["method"] ?? fallbackMethod;
		return new RpcDisconnectedError({ method: method });
	}
	const message = error instanceof Error ? error.message : String(error);
	return new RpcHandlerError({ method: fallbackMethod, reason: message });
}

export function normalizeRpcError(error: unknown, fallbackMethod = "unknown"): RpcError {
	return isRpcError(error) ? error : mapToRpcError(error, fallbackMethod);
}
