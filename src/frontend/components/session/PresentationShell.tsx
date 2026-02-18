import { useEffect, useRef } from "react";
import type { Turn } from "../../../shared/types.ts";
import { useKeyboard } from "../../hooks/useKeyboard.ts";
import { usePresentationMode } from "../../hooks/usePresentationMode.ts";
import { MessageList } from "../message/MessageList.tsx";

interface PresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  sessionId: string;
  project: string;
  pluginId?: string;
  isSubAgent?: boolean;
}

export function PresentationShell({
  turns,
  onExit,
  sessionId,
  project,
  pluginId,
  isSubAgent,
}: PresentationShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const presentation = usePresentationMode(turns);

  // Auto-enter presentation when turns are available
  useEffect(() => {
    if (turns.length > 0 && !presentation.active) {
      presentation.enter();
    }
  }, [turns, presentation]);

  useKeyboard(
    {
      onNext: presentation.next,
      onPrev: presentation.prev,
      onNextTurn: presentation.nextTurn,
      onPrevTurn: presentation.prevTurn,
      onEscape: onExit,
      onFullscreen: presentation.toggleFullscreen,
    },
    presentation.active,
  );

  // Auto-scroll to bottom when step changes
  const currentStep = presentation.currentStep;
  useEffect(() => {
    if (currentStep >= 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentStep]);

  const progress =
    presentation.totalSteps > 0
      ? ((presentation.currentStep + 1) / presentation.totalSteps) * 100
      : 0;

  return (
    <div
      className={`presentation-mode ${presentation.fullscreen ? "fullscreen" : ""}`}
      ref={scrollRef}
      style={{ overflowY: "auto", height: "calc(100vh - 92px)" }}
    >
      <MessageList
        turns={presentation.visibleTurns}
        visibleSubSteps={presentation.visibleSubSteps}
        sessionId={sessionId}
        project={project}
        pluginId={pluginId}
        isSubAgent={isSubAgent}
      />
      <div className="presentation-progress">
        <span>
          Step {presentation.currentStep + 1} / {presentation.totalSteps}
        </span>
        <div className="presentation-progress-bar">
          <div className="presentation-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: "0.75rem" }}>
          ← → step · ↑ ↓ message · Esc exit · F fullscreen
        </span>
      </div>
    </div>
  );
}
