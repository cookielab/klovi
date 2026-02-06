import { useEffect, useState } from "react";
import type { Session } from "../../../shared/types.ts";
import { PresentationShell } from "./PresentationShell.tsx";

interface SubAgentPresentationProps {
  sessionId: string;
  project: string;
  agentId: string;
  onExit: () => void;
}

export function SubAgentPresentation({
  sessionId,
  project,
  agentId,
  onExit,
}: SubAgentPresentationProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sessions/${sessionId}/subagents/${agentId}?project=${encodeURIComponent(project)}`)
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, project, agentId]);

  if (loading) return <div className="loading">Loading sub-agent conversation...</div>;
  if (!session || session.turns.length === 0) return null;

  return (
    <PresentationShell
      turns={session.turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
      isSubAgent
    />
  );
}
