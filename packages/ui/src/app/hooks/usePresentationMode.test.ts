import { act, renderHook } from "@testing-library/react";
import type { AssistantTurn, ContentBlock, Turn, UserTurn } from "../../shared/types";
import { usePresentationMode } from "./usePresentationMode";


const N_3 = 3;

function userTurn(text = "hello"): UserTurn {
	return {
		kind: "user",
		uuid: crypto.randomUUID(),
		timestamp: "2025-01-01T00:00:00Z",
		text: text,
	};
}

function assistantTurn(opts: { thinking?: number; text?: number; tools?: number } = {}): AssistantTurn {
	const { thinking = 0, text = 1, tools = 0 } = opts;
	return {
		kind: "assistant",
		uuid: crypto.randomUUID(),
		timestamp: "2025-01-01T00:00:00Z",
		model: "claude-sonnet-4-20250514",
		contentBlocks: [
			...Array.from({ length: thinking }, () => ({
				type: "thinking" as const,
				block: { text: "thinking..." },
			})),
			...Array.from({ length: text }, () => ({
				type: "text" as const,
				text: "response",
			})),
			...Array.from({ length: tools }, (_, i) => ({
				type: "tool_call" as const,
				call: { toolUseId: `tool-${i}`, kind: "generic" as const, title: "Read", name: "Read", input: {}, result: "ok", isError: false },
			})),
		] satisfies ContentBlock[],
	};
}

describe("usePresentationMode", () => {
	describe("initial state", () => {
		it("starts inactive", () => {
			const { result } = renderHook(() => usePresentationMode([]));
			expect(result.current.active).toBe(false);
			expect(result.current.fullscreen).toBe(false);
			expect(result.current.currentStep).toBe(0);
		});

		it("shows all turns when inactive", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.visibleTurns).toEqual(turns);
		});
	});

	describe("step counting", () => {
		it("user turn = 1 step", () => {
			const turns: Turn[] = [userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.totalSteps).toBe(1);
		});

		it("assistant turn with only text = 1 step", () => {
			const turns: Turn[] = [assistantTurn({ text: 1 })];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.totalSteps).toBe(1);
		});

		it("assistant turn with thinking + text = 2 steps", () => {
			const turns: Turn[] = [assistantTurn({ thinking: 1, text: 1 })];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.totalSteps).toBe(2);
		});

		it("assistant turn with thinking + text + tool calls = N steps", () => {
			const turns: Turn[] = [assistantTurn({ thinking: 1, text: 1, tools: N_3 })];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.totalSteps).toBe(N_3); // thinking + text + 3 tools grouped
		});

		it("empty assistant turn = minimum 1 step", () => {
			const turns: Turn[] = [assistantTurn({ thinking: 0, text: 0 })];
			const { result } = renderHook(() => usePresentationMode(turns));
			expect(result.current.totalSteps).toBe(1);
		});

		it("empty turns array = 0 steps", () => {
			const { result } = renderHook(() => usePresentationMode([]));
			expect(result.current.totalSteps).toBe(0);
		});
	});

	describe("enter/exit", () => {
		it("enter activates presentation mode at step 0", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			expect(result.current.active).toBe(true);
			expect(result.current.currentStep).toBe(0);
		});

		it("exit deactivates and resets", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.next());
			act(() => result.current.exit());
			expect(result.current.active).toBe(false);
			expect(result.current.currentStep).toBe(0);
			expect(result.current.fullscreen).toBe(false);
		});
	});

	describe("navigation", () => {
		it("next advances one step", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.next());
			expect(result.current.currentStep).toBe(1);
		});

		it("next does not go past last step", () => {
			const turns: Turn[] = [userTurn()]; // 1 step total
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.next());
			act(() => result.current.next());
			expect(result.current.currentStep).toBe(0); // clamped at length-1 = 0
		});

		it("prev goes back one step", () => {
			const turns: Turn[] = [userTurn(), assistantTurn(), userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.next());
			act(() => result.current.next());
			act(() => result.current.prev());
			expect(result.current.currentStep).toBe(1);
		});

		it("prev does not go below 0", () => {
			const turns: Turn[] = [userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.prev());
			expect(result.current.currentStep).toBe(0);
		});
	});

	describe("turn navigation", () => {
		it("nextTurn jumps to end of next turn", () => {
			// user(1 step) + assistant(2 steps: thinking+text) + user(1 step)
			const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1 }), userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			// At step 0 (user turn). nextTurn should jump to end of user turn boundary = step 0,
			// then to end of assistant turn = step 2
			act(() => result.current.nextTurn());
			expect(result.current.currentStep).toBe(2);
		});

		it("nextTurn stays at end when already at last step", () => {
			const turns: Turn[] = [userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.nextTurn());
			expect(result.current.currentStep).toBe(0);
		});

		it("prevTurn jumps to end of previous turn", () => {
			const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1 }), userTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			// Go to the last step
			act(() => result.current.next()); // step 1
			act(() => result.current.next()); // step 2
			act(() => result.current.next()); // step 3
			act(() => result.current.prevTurn());
			expect(result.current.currentStep).toBe(2);
		});

		it("prevTurn stays at 0 when already at start", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			act(() => result.current.prevTurn());
			expect(result.current.currentStep).toBe(0);
		});
	});

	describe("visible turns and sub-steps", () => {
		it("shows only first turn at step 0", () => {
			const turns: Turn[] = [userTurn(), assistantTurn()];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			expect(result.current.visibleTurns).toHaveLength(1);
		});

		it("sub-steps map tracks visible sub-steps per turn", () => {
			const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1, tools: 1 })];
			const { result } = renderHook(() => usePresentationMode(turns));
			act(() => result.current.enter());
			// step 0: user turn
			expect(result.current.visibleSubSteps.get(0)).toBe(1);

			// step 1: first sub-step of assistant (thinking)
			act(() => result.current.next());
			expect(result.current.visibleTurns).toHaveLength(2);
			expect(result.current.visibleSubSteps.get(0)).toBe(1); // user: all shown
			expect(result.current.visibleSubSteps.get(1)).toBe(1); // assistant: 1 sub-step

			// step 2: second sub-step (text)
			act(() => result.current.next());
			expect(result.current.visibleSubSteps.get(1)).toBe(2);

			// step 3: third sub-step (tool call)
			act(() => result.current.next());
			expect(result.current.visibleSubSteps.get(1)).toBe(N_3);
		});
	});

	describe("fullscreen", () => {
		it("toggleFullscreen toggles state", () => {
			const { result } = renderHook(() => usePresentationMode([]));
			expect(result.current.fullscreen).toBe(false);
			act(() => result.current.toggleFullscreen());
			expect(result.current.fullscreen).toBe(true);
			act(() => result.current.toggleFullscreen());
			expect(result.current.fullscreen).toBe(false);
		});
	});
});
