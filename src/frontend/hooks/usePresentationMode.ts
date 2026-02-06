import { useState, useMemo, useCallback } from "react";
import type { Turn, AssistantTurn } from "../../shared/types.ts";

interface PresentationState {
  active: boolean;
  fullscreen: boolean;
  currentStep: number;
  totalSteps: number;
  visibleTurns: Turn[];
  visibleSubSteps: Map<number, number>;
  enter: () => void;
  exit: () => void;
  next: () => void;
  prev: () => void;
  toggleFullscreen: () => void;
}

function countSubSteps(turn: Turn): number {
  if (turn.kind !== "assistant") return 1;
  const a = turn as AssistantTurn;
  let count = 0;
  if (a.thinkingBlocks.length > 0) count++;
  if (a.textBlocks.length > 0) count++;
  count += a.toolCalls.length;
  return Math.max(count, 1);
}

export function usePresentationMode(turns: Turn[]): PresentationState {
  const [active, setActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Build flat list of steps: each turn has N sub-steps
  const steps = useMemo(() => {
    const result: { turnIndex: number; subStep: number }[] = [];
    for (let i = 0; i < turns.length; i++) {
      const sub = countSubSteps(turns[i]!);
      for (let s = 0; s < sub; s++) {
        result.push({ turnIndex: i, subStep: s });
      }
    }
    return result;
  }, [turns]);

  const totalSteps = steps.length;

  // Compute which turns and sub-steps are visible
  const { visibleTurns, visibleSubSteps } = useMemo(() => {
    if (!active || steps.length === 0) {
      return { visibleTurns: turns, visibleSubSteps: new Map<number, number>() };
    }

    const step = steps[Math.min(currentStep, steps.length - 1)]!;
    const maxTurnIndex = step.turnIndex;
    const visible = turns.slice(0, maxTurnIndex + 1);

    // All turns before the current one show all sub-steps
    const subSteps = new Map<number, number>();
    for (let i = 0; i < maxTurnIndex; i++) {
      subSteps.set(i, countSubSteps(turns[i]!));
    }
    // Current turn shows up to current sub-step
    subSteps.set(maxTurnIndex, step.subStep + 1);

    return { visibleTurns: visible, visibleSubSteps: subSteps };
  }, [active, currentStep, steps, turns]);

  const enter = useCallback(() => {
    setActive(true);
    setCurrentStep(0);
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setFullscreen(false);
    setCurrentStep(0);
  }, []);

  const next = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((f) => !f);
  }, []);

  return {
    active,
    fullscreen,
    currentStep,
    totalSteps,
    visibleTurns,
    visibleSubSteps,
    enter,
    exit,
    next,
    prev,
    toggleFullscreen,
  };
}
