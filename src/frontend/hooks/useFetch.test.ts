import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { useFetch } from "./useFetch.ts";

let originalFetch: typeof globalThis.fetch;

function mockFetch(
  response: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

describe("useFetch", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("starts in loading state", () => {
    mockFetch(() => new Promise(() => {}));
    const { result } = renderHook(() => useFetch("/api/test", []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("returns data on successful fetch", async () => {
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ value: 42 }), { status: 200 })));
    const { result } = renderHook(() => useFetch<{ value: number }>("/api/test", []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBeNull();
  });

  test("returns error on HTTP failure", async () => {
    mockFetch(() => Promise.resolve(new Response("Not Found", { status: 404 })));
    const { result } = renderHook(() => useFetch("/api/test", []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("HTTP 404");
    expect(result.current.data).toBeNull();
  });

  test("returns error on network failure", async () => {
    mockFetch(() => Promise.reject(new Error("Network error")));
    const { result } = renderHook(() => useFetch("/api/test", []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBeNull();
  });

  test("retry refetches data", async () => {
    let callCount = 0;
    mockFetch(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response("Error", { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    const { result } = renderHook(() => useFetch<{ ok: boolean }>("/api/test", []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("HTTP 500");

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeNull();
  });

  test("aborts in-flight request on unmount", () => {
    let capturedSignal: AbortSignal | null | undefined;

    mockFetch((_input, init) => {
      capturedSignal = init?.signal;
      return new Promise(() => {});
    });

    const { unmount } = renderHook(() => useFetch("/api/test", []));
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    unmount();
    expect(capturedSignal!.aborted).toBe(true);
  });
});
