import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Session, Turn } from "../../shared/types";
import { MockProviders, setupMockRPC } from "../test-helpers/mock-rpc";
import { useSessionData } from "./useSessionData";

afterEach(cleanup);

function makeTurn(i: number): Turn {
	return { kind: "user", uuid: `t-${i}`, timestamp: "2025-01-15T10:00:00Z", text: `m ${i}` } as Turn;
}

describe("useSessionData two-phase load", () => {
	it("fires head and tail in parallel", async () => {
		const headTurns = [makeTurn(0), makeTurn(1)];
		const headFn = mock((_params: { sessionId: string; project: string; headSize?: number }) =>
			Promise.resolve({
				session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
				totalTurns: 3,
			}),
		);
		const tailFn = mock((_params: { sessionId: string; project: string; fromTurn: number }) =>
			Promise.resolve({ turns: [makeTurn(2)] }),
		);
		setupMockRPC({ getSessionHead: headFn, getSessionTail: tailFn });

		renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		await waitFor(() => expect(headFn).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(tailFn).toHaveBeenCalledTimes(1));
		expect(headFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", headSize: 100 });
		expect(tailFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", fromTurn: 100 });
	});

	it("renders head turns first, then appends tail", async () => {
		const headTurns = Array.from({ length: 100 }, (_, i) => makeTurn(i));
		const tailTurns = Array.from({ length: 50 }, (_, i) => makeTurn(100 + i));
		setupMockRPC({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: 150,
				}),
			getSessionTail: () => Promise.resolve({ turns: tailTurns }),
		});

		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(150));
		const turnIds = result.current.data?.session.turns.map((t) => t.uuid) ?? [];
		expect(turnIds[0]).toBe("t-0");
		expect(turnIds[149]).toBe("t-149");
	});

	it("renders head even if tail is still pending", async () => {
		const headTurns = [makeTurn(0), makeTurn(1)];
		setupMockRPC({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: 50,
				}),
			getSessionTail: () => new Promise(() => undefined), // never resolves
		});
		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });
		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(2));
		expect(result.current.loading).toBe(false);
	});
});
