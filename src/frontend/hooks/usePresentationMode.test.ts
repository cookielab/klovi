import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { AssistantTurn, Turn, UserTurn } from "../../shared/types.ts";
import { usePresentationMode } from "./usePresentationMode.ts";

function userTurn(text = "hello"): UserTurn {
  return {
    kind: "user",
    uuid: crypto.randomUUID(),
    timestamp: "2025-01-01T00:00:00Z",
    text,
  };
}

function assistantTurn(
  opts: { thinking?: number; text?: number; tools?: number } = {},
): AssistantTurn {
  const { thinking = 0, text = 1, tools = 0 } = opts;
  return {
    kind: "assistant",
    uuid: crypto.randomUUID(),
    timestamp: "2025-01-01T00:00:00Z",
    model: "claude-sonnet-4-20250514",
    thinkingBlocks: Array.from({ length: thinking }, () => ({
      text: "thinking...",
    })),
    textBlocks: Array.from({ length: text }, () => "response"),
    toolCalls: Array.from({ length: tools }, (_, i) => ({
      toolUseId: `tool-${i}`,
      name: "Read",
      input: {},
      result: "ok",
      isError: false,
    })),
  };
}

describe("usePresentationMode", () => {
  describe("initial state", () => {
    test("starts inactive", () => {
      const { result } = renderHook(() => usePresentationMode([]));
      expect(result.current.active).toBe(false);
      expect(result.current.fullscreen).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    test("shows all turns when inactive", () => {
      const turns: Turn[] = [userTurn(), assistantTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.visibleTurns).toEqual(turns);
    });
  });

  describe("step counting", () => {
    test("user turn = 1 step", () => {
      const turns: Turn[] = [userTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.totalSteps).toBe(1);
    });

    test("assistant turn with only text = 1 step", () => {
      const turns: Turn[] = [assistantTurn({ text: 1 })];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.totalSteps).toBe(1);
    });

    test("assistant turn with thinking + text = 2 steps", () => {
      const turns: Turn[] = [assistantTurn({ thinking: 1, text: 1 })];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.totalSteps).toBe(2);
    });

    test("assistant turn with thinking + text + tool calls = N steps", () => {
      const turns: Turn[] = [assistantTurn({ thinking: 1, text: 1, tools: 3 })];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.totalSteps).toBe(5); // thinking + text + 3 tools
    });

    test("empty assistant turn = minimum 1 step", () => {
      const turns: Turn[] = [assistantTurn({ thinking: 0, text: 0 })];
      const { result } = renderHook(() => usePresentationMode(turns));
      expect(result.current.totalSteps).toBe(1);
    });

    test("empty turns array = 0 steps", () => {
      const { result } = renderHook(() => usePresentationMode([]));
      expect(result.current.totalSteps).toBe(0);
    });
  });

  describe("enter/exit", () => {
    test("enter activates presentation mode at step 0", () => {
      const turns: Turn[] = [userTurn(), assistantTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      expect(result.current.active).toBe(true);
      expect(result.current.currentStep).toBe(0);
    });

    test("exit deactivates and resets", () => {
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
    test("next advances one step", () => {
      const turns: Turn[] = [userTurn(), assistantTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.next());
      expect(result.current.currentStep).toBe(1);
    });

    test("next does not go past last step", () => {
      const turns: Turn[] = [userTurn()]; // 1 step total
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.next());
      act(() => result.current.next());
      expect(result.current.currentStep).toBe(0); // clamped at length-1 = 0
    });

    test("prev goes back one step", () => {
      const turns: Turn[] = [userTurn(), assistantTurn(), userTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.next());
      act(() => result.current.next());
      act(() => result.current.prev());
      expect(result.current.currentStep).toBe(1);
    });

    test("prev does not go below 0", () => {
      const turns: Turn[] = [userTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.prev());
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe("turn navigation", () => {
    test("nextTurn jumps to end of next turn", () => {
      // user(1 step) + assistant(2 steps: thinking+text) + user(1 step)
      const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1 }), userTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      // At step 0 (user turn). nextTurn should jump to end of user turn boundary = step 0,
      // then to end of assistant turn = step 2
      act(() => result.current.nextTurn());
      expect(result.current.currentStep).toBe(2);
    });

    test("nextTurn stays at end when already at last step", () => {
      const turns: Turn[] = [userTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.nextTurn());
      expect(result.current.currentStep).toBe(0);
    });

    test("prevTurn jumps to end of previous turn", () => {
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

    test("prevTurn stays at 0 when already at start", () => {
      const turns: Turn[] = [userTurn(), assistantTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      act(() => result.current.prevTurn());
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe("visible turns and sub-steps", () => {
    test("shows only first turn at step 0", () => {
      const turns: Turn[] = [userTurn(), assistantTurn()];
      const { result } = renderHook(() => usePresentationMode(turns));
      act(() => result.current.enter());
      expect(result.current.visibleTurns).toHaveLength(1);
    });

    test("sub-steps map tracks visible sub-steps per turn", () => {
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
      expect(result.current.visibleSubSteps.get(1)).toBe(3);
    });
  });

  describe("fullscreen", () => {
    test("toggleFullscreen toggles state", () => {
      const { result } = renderHook(() => usePresentationMode([]));
      expect(result.current.fullscreen).toBe(false);
      act(() => result.current.toggleFullscreen());
      expect(result.current.fullscreen).toBe(true);
      act(() => result.current.toggleFullscreen());
      expect(result.current.fullscreen).toBe(false);
    });
  });
});
