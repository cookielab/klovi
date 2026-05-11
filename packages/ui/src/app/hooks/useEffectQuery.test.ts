import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { MockProviders } from "../test-helpers/mock-rpc";
import { useEffectQuery } from "./useEffectQuery";

const N_42 = 42;

describe("useEffectQuery", () => {
	afterEach(() => {
		cleanup();
	});

	it("starts in loading state", () => {
		const rpcCall = (): Effect.Effect<{ value: number }, never, never> =>
			Effect.never as Effect.Effect<{ value: number }, never, never>;
		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });
		expect(result.current.loading).toBe(true);
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it("returns data on successful call", async () => {
		const rpcCall = (): Effect.Effect<{ value: number }, never, never> => Effect.succeed({ value: N_42 });
		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual({ value: N_42 });
		expect(result.current.error).toBeNull();
	});

	it("returns typed RpcHandlerError on generic failure", async () => {
		const rpcCall = (): Effect.Effect<never, Error, never> => Effect.fail(new Error("Server error"));
		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();
		expect(result.current.error?._tag).toBe("RpcHandlerError");
		expect(result.current.data).toBeNull();
	});

	it("returns RpcTimeoutError for timeout errors", async () => {
		const error = new Error("RPC request timed out. (getProjects exceeded 30000ms)");
		const rpcCall = (): Effect.Effect<never, Error, never> => Effect.fail(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?._tag).toBe("RpcTimeoutError");
	});

	it("returns RpcDisconnectedError for disconnect errors", async () => {
		const error = new Error("Desktop host disconnected during getSession.");
		const rpcCall = (): Effect.Effect<never, Error, never> => Effect.fail(error);
		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error?._tag).toBe("RpcDisconnectedError");
	});

	it("retry refetches data", async () => {
		let callCount = 0;
		const rpcCall = (): Effect.Effect<{ ok: boolean }, Error, never> => {
			callCount += 1;
			if (callCount === 1) {
				return Effect.fail(new Error("fail"));
			}
			return Effect.succeed({ ok: true });
		};

		const { result } = renderHook(() => useEffectQuery(rpcCall, []), { wrapper: MockProviders });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).not.toBeNull();

		act(() => {
			result.current.retry();
		});
		await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
		expect(result.current.error).toBeNull();
	});
});
