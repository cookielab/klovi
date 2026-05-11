import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Session, Turn } from "../../shared/types";
import { MockProviders, setupMockRpc } from "../test-helpers/mock-rpc";
import { useSessionData } from "./useSessionData";

const noop = (): undefined => undefined;
const N_3 = 3;
const N_100 = 100;
const N_50 = 50;
const N_150 = 150;
const N_149 = 149;

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
				totalTurns: N_3,
			}),
		);
		const tailFn = mock((_params: { sessionId: string; project: string; fromTurn: number }) =>
			Promise.resolve({ turns: [makeTurn(2)] }),
		);
		setupMockRpc({ getSessionHead: headFn, getSessionTail: tailFn });

		renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		await waitFor(() => expect(headFn).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(tailFn).toHaveBeenCalledTimes(1));
		expect(headFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", headSize: N_100 });
		expect(tailFn.mock.calls[0]?.[0]).toEqual({ sessionId: "s1", project: "p1", fromTurn: N_100 });
	});

	it("renders head turns first, then appends tail", async () => {
		const headTurns = Array.from({ length: N_100 }, (_, i) => makeTurn(i));
		const tailTurns = Array.from({ length: N_50 }, (_, i) => makeTurn(N_100 + i));
		setupMockRpc({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: N_150,
				}),
			getSessionTail: () => Promise.resolve({ turns: tailTurns }),
		});

		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });

		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(N_150));
		const turnIds = result.current.data?.session.turns.map((t) => t.uuid) ?? [];
		expect(turnIds[0]).toBe("t-0");
		expect(turnIds[N_149]).toBe("t-149");
	});

	it("renders head even if tail is still pending", async () => {
		const headTurns = [makeTurn(0), makeTurn(1)];
		setupMockRpc({
			getSessionHead: () =>
				Promise.resolve({
					session: { sessionId: "s1", project: "p1", turns: headTurns } as Session,
					totalTurns: N_50,
				}),
			getSessionTail: () => new Promise(noop), // never resolves
		});
		const { result } = renderHook(() => useSessionData("s1", "p1"), { wrapper: MockProviders });
		await waitFor(() => expect(result.current.data?.session.turns.length).toBe(2));
		expect(result.current.loading).toBe(false);
	});
});
