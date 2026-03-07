import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useRPC } from "./useRpc.ts";

describe("useRPC", () => {
  afterEach(() => {
    cleanup();
  });

  test("starts in loading state", () => {
    const rpcCall = () => new Promise<{ value: number }>(() => {});
    const { result } = renderHook(() => useRPC(rpcCall, []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("returns data on successful call", async () => {
    const rpcCall = () => Promise.resolve({ value: 42 });
    const { result } = renderHook(() => useRPC(rpcCall, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
  });

  test("returns error on failure", async () => {
    const rpcCall = () => Promise.reject(new Error("RPC failed"));
    const { result } = renderHook(() => useRPC(rpcCall, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC failed");
    expect(result.current.data).toBeNull();
  });

  test("retry refetches data", async () => {
    let callCount = 0;
    const rpcCall = () => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("fail"));
      return Promise.resolve({ ok: true });
    };

    const { result } = renderHook(() => useRPC(rpcCall, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("fail");

    void act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeNull();
  });
});
