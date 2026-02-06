import { useEffect, useState } from "react";
import type { Session } from "../../../shared/types.ts";
import { PresentationShell } from "./PresentationShell.tsx";

interface SessionPresentationProps {
  sessionId: string;
  project: string;
  onExit: () => void;
}

export function SessionPresentation({ sessionId, project, onExit }: SessionPresentationProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sessions/${sessionId}?project=${encodeURIComponent(project)}`)
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, project]);

  if (loading) return <div className="loading">Loading session...</div>;
  if (!session) return null;

  return (
    <PresentationShell
      turns={session.turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
    />
  );
}
