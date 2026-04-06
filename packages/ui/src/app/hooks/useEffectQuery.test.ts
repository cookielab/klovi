import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useEffectQuery } from "./useEffectQuery.ts";

describe("useEffectQuery", () => {
	afterEach(() => {
		cleanup();
	});

	test("starts in loading state", () => {
		const rpcCall = () => new Promise<{ value: number }>(() => {});
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));
		expect(result.current.loading).toBe(true);
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
	});

	test("returns data on successful call", async () => {
		const rpcCall = () => Promise.resolve({ value: 42 });
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ value: 42 });
		expect(result.current.error).toBeNull();
	});

	test("returns typed RpcHandlerError on generic failure", async () => {
		const rpcCall = () => Promise.reject(new Error("Server error"));
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();
		expect(result.current.error?._tag).toBe("RpcHandlerError");
		expect(result.current.data).toBeNull();
	});

	test("returns RpcTimeoutError for timeout errors", async () => {
		const error = new Error("RPC request timed out. (getProjects exceeded 30000ms)");
		const rpcCall = () => Promise.reject(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?._tag).toBe("RpcTimeoutError");
	});

	test("returns RpcDisconnectedError for disconnect errors", async () => {
		const error = new Error("Desktop host disconnected during getSession.");
		const rpcCall = () => Promise.reject(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?._tag).toBe("RpcDisconnectedError");
	});

	test("retry refetches data", async () => {
		let callCount = 0;
		const rpcCall = () => {
			callCount += 1;
			if (callCount === 1) {
				return Promise.reject(new Error("fail"));
			}
			return Promise.resolve({ ok: true });
		};

		const { result } = renderHook(() => useEffectQuery(rpcCall, []));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();

		result.current.retry();
		await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
		expect(result.current.error).toBeNull();
	});
});
