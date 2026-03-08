import { useCallback, useMemo, useState } from "react";
import type { AssistantTurn, Turn } from "../types/index.ts";
import { groupContentBlocks } from "../types/index.ts";

export interface PresentationState {
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
  nextTurn: () => void;
  prevTurn: () => void;
  toggleFullscreen: () => void;
}

function countSubSteps(turn: Turn): number {
  if (turn.kind !== "assistant") return 1;
  const a = turn as AssistantTurn;
  return Math.max(groupContentBlocks(a.contentBlocks).length, 1);
}

export function usePresentationMode(turns: Turn[]): PresentationState {
  const [active, setActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Build flat list of steps: each turn has N sub-steps
  const steps = useMemo(() => {
    const result: { turnIndex: number; subStep: number }[] = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (!turn) continue;
      const sub = countSubSteps(turn);
      for (let s = 0; s < sub; s++) {
        result.push({ turnIndex: i, subStep: s });
      }
    }
    return result;
  }, [turns]);

  const totalSteps = steps.length;

  // Turn boundaries: the step index of the last sub-step of each turn
  const turnBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      const next = steps[i + 1];
      if (!next || next.turnIndex !== steps[i]?.turnIndex) {
        boundaries.push(i);
      }
    }
    return boundaries;
  }, [steps]);

  // Compute which turns and sub-steps are visible
  const { visibleTurns, visibleSubSteps } = useMemo(() => {
    if (!active || steps.length === 0) {
      return { visibleTurns: turns, visibleSubSteps: new Map<number, number>() };
    }

    const step = steps[Math.min(currentStep, steps.length - 1)];
    if (!step) return { visibleTurns: turns, visibleSubSteps: new Map<number, number>() };
    const maxTurnIndex = step.turnIndex;
    const visible = turns.slice(0, maxTurnIndex + 1);

    // All turns before the current one show all sub-steps
    const subSteps = new Map<number, number>();
    for (let i = 0; i < maxTurnIndex; i++) {
      const turn = turns[i];
      if (!turn) continue;
      subSteps.set(i, countSubSteps(turn));
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

  const nextTurn = useCallback(() => {
    setCurrentStep((s) => {
      for (const b of turnBoundaries) {
        if (b > s) return b;
      }
      return s;
    });
  }, [turnBoundaries]);

  const prevTurn = useCallback(() => {
    setCurrentStep((s) => {
      for (let i = turnBoundaries.length - 1; i >= 0; i--) {
        const boundary = turnBoundaries[i];
        if (boundary !== undefined && boundary < s) return boundary;
      }
      return s;
    });
  }, [turnBoundaries]);

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
    nextTurn,
    prevTurn,
    toggleFullscreen,
  };
}
