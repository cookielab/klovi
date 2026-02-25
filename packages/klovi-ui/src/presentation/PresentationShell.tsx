import { useEffect, useRef } from "react";
import { MessageList } from "../messages/index.ts";
import type { Turn } from "../types/index.ts";
import styles from "./PresentationShell.module.css";
import { useKeyboard } from "./useKeyboard.ts";
import { usePresentationMode } from "./usePresentationMode.ts";

function s(name: string | undefined): string {
  return name ?? "";
}

interface PresentationShellProps {
  turns: Turn[];
  onExit: () => void;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  isSubAgent?: boolean | undefined;
  onNavigateToSubAgent?: ((id: string) => void) | undefined;
  theme?: string | undefined;
  fontSize?: number | undefined;
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

  const className = [
    s(styles["presentationMode"]),
    presentation.fullscreen ? s(styles["fullscreen"]) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
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
      <div className={s(styles["progress"])}>
        <span>
          Step {presentation.currentStep + 1} / {presentation.totalSteps}
        </span>
        <div className={s(styles["progressBar"])}>
          <div className={s(styles["progressFill"])} style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: "0.75rem" }}>
          ← → step · ↑ ↓ message · Esc exit · F fullscreen
        </span>
      </div>
    </div>
  );
}
