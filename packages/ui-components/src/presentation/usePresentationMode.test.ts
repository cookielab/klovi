import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { AssistantTurn, ContentBlock, Turn, UserTurn } from "../types/index.ts";
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
  options: { thinking?: number; text?: number; tools?: number } = {},
): AssistantTurn {
  const { thinking = 0, text = 1, tools = 0 } = options;
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
        call: {
          toolUseId: `tool-${i}`,
          name: "Read",
          input: {},
          result: "ok",
          isError: false,
        },
      })),
    ] satisfies ContentBlock[],
  };
}

describe("usePresentationMode", () => {
  test("initial state is inactive and shows all turns", () => {
    const turns: Turn[] = [userTurn(), assistantTurn()];
    const { result } = renderHook(() => usePresentationMode(turns));

    expect(result.current.active).toBe(false);
    expect(result.current.fullscreen).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.visibleTurns).toEqual(turns);
  });

  test("counts grouped sub-steps across turns", () => {
    const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1, tools: 2 })];
    const { result } = renderHook(() => usePresentationMode(turns));

    expect(result.current.totalSteps).toBe(4);
  });

  test("handles empty turns list", () => {
    const { result } = renderHook(() => usePresentationMode([]));

    expect(result.current.totalSteps).toBe(0);
    expect(result.current.visibleTurns).toEqual([]);
  });

  test("enter and exit reset and clamp navigation state", () => {
    const turns: Turn[] = [userTurn(), assistantTurn()];
    const { result } = renderHook(() => usePresentationMode(turns));

    act(() => result.current.enter());
    expect(result.current.active).toBe(true);

    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);

    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.fullscreen).toBe(false);
  });

  test("nextTurn jumps to next turn boundary", () => {
    const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1 }), userTurn()];
    const { result } = renderHook(() => usePresentationMode(turns));

    act(() => result.current.enter());
    act(() => result.current.nextTurn());

    expect(result.current.currentStep).toBe(2);
  });

  test("prevTurn jumps to previous turn boundary", () => {
    const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1 }), userTurn()];
    const { result } = renderHook(() => usePresentationMode(turns));

    act(() => result.current.enter());
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.prevTurn());

    expect(result.current.currentStep).toBe(2);
  });

  test("visible turns and substeps update with current step", () => {
    const turns: Turn[] = [userTurn(), assistantTurn({ thinking: 1, text: 1, tools: 1 })];
    const { result } = renderHook(() => usePresentationMode(turns));

    act(() => result.current.enter());
    expect(result.current.visibleTurns).toHaveLength(1);
    expect(result.current.visibleSubSteps.get(0)).toBe(1);

    act(() => result.current.next());
    expect(result.current.visibleTurns).toHaveLength(2);
    expect(result.current.visibleSubSteps.get(1)).toBe(1);

    act(() => result.current.next());
    expect(result.current.visibleSubSteps.get(1)).toBe(2);

    act(() => result.current.next());
    expect(result.current.visibleSubSteps.get(1)).toBe(3);
  });

  test("toggleFullscreen switches mode", () => {
    const { result } = renderHook(() => usePresentationMode([]));

    expect(result.current.fullscreen).toBe(false);

    act(() => result.current.toggleFullscreen());
    expect(result.current.fullscreen).toBe(true);

    act(() => result.current.toggleFullscreen());
    expect(result.current.fullscreen).toBe(false);
  });
});
