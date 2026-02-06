import React, { useState, useEffect, useRef } from "react";
import type { Session } from "../../../shared/types.ts";
import { MessageList } from "../message/MessageList.tsx";
import { usePresentationMode } from "../../hooks/usePresentationMode.ts";
import { useKeyboard } from "../../hooks/useKeyboard.ts";

interface SessionPresentationProps {
  sessionId: string;
  project: string;
  onExit: () => void;
}

export function SessionPresentation({
  sessionId,
  project,
  onExit,
}: SessionPresentationProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/sessions/${sessionId}?project=${encodeURIComponent(project)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, project]);

  const presentation = usePresentationMode(session?.turns ?? []);

  // Auto-enter presentation when session loads
  useEffect(() => {
    if (session && !presentation.active) {
      presentation.enter();
    }
  }, [session]);

  useKeyboard(
    {
      onNext: presentation.next,
      onPrev: presentation.prev,
      onEscape: onExit,
      onFullscreen: presentation.toggleFullscreen,
    },
    presentation.active
  );

  // Auto-scroll to bottom when step changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [presentation.currentStep]);

  if (loading) return <div className="loading">Loading session...</div>;
  if (!session) return null;

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
      />
      <div className="presentation-progress">
        <span>
          Step {presentation.currentStep + 1} / {presentation.totalSteps}
        </span>
        <div className="presentation-progress-bar">
          <div
            className="presentation-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span style={{ fontSize: "0.75rem" }}>
          ← → navigate · Esc exit · F fullscreen
        </span>
      </div>
    </div>
  );
}
