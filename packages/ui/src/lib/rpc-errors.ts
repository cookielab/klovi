type KloviRpcErrorCode = "rpc-timeout" | "rpc-disconnected";

type KloviRpcError = Error & { code?: KloviRpcErrorCode; cause?: unknown };

function createRpcError(code: KloviRpcErrorCode, message: string, cause?: unknown): KloviRpcError {
	const error = new Error(message) as KloviRpcError;
	error.name = "KloviRpcError";
	error.code = code;
	error.cause = cause;
	return error;
}

function createRpcTimeoutError(method: string, timeoutMs: number, cause?: unknown): Error {
	return createRpcError("rpc-timeout", `RPC request timed out. (${method} exceeded ${timeoutMs}ms)`, cause);
}

function createRpcDisconnectedError(method: string, cause?: unknown): Error {
	return createRpcError("rpc-disconnected", `Desktop host disconnected during ${method}.`, cause);
}

function getRpcErrorCode(error: unknown): KloviRpcErrorCode | null {
	if (error instanceof Error) {
		const maybeRpcError = error as KloviRpcError;
		if (maybeRpcError.code === "rpc-timeout" || maybeRpcError.code === "rpc-disconnected") {
			return maybeRpcError.code;
		}

		const message = error.message.toLowerCase();
		if (message.includes("rpc request timed out")) {
			return "rpc-timeout";
		}
		if (
			message.includes("desktop host disconnected") ||
			message.includes("socket closed") ||
			message.includes("transport unavailable")
		) {
			return "rpc-disconnected";
		}
	}

	return null;
}

function isRpcTransportError(error: unknown): boolean {
	return getRpcErrorCode(error) !== null;
}

function isRpcTimeoutError(error: unknown): boolean {
	return getRpcErrorCode(error) === "rpc-timeout";
}

export type { KloviRpcErrorCode };
export { createRpcDisconnectedError, createRpcTimeoutError, getRpcErrorCode, isRpcTimeoutError, isRpcTransportError };
