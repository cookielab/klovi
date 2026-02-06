import { useEffect, useState } from "react";
import type { Session } from "../../../shared/types.ts";
import { MessageList } from "./MessageList.tsx";

interface SubAgentViewProps {
  sessionId: string;
  project: string;
  agentId: string;
}

export function SubAgentView({ sessionId, project, agentId }: SubAgentViewProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${sessionId}/subagents/${agentId}?project=${encodeURIComponent(project)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [sessionId, project, agentId]);

  if (loading) return <div className="loading">Loading sub-agent conversation...</div>;
  if (error)
    return (
      <div className="loading" style={{ color: "var(--error)" }}>
        Error: {error}
      </div>
    );
  if (!session || session.turns.length === 0)
    return <div className="subagent-empty">No sub-agent conversation data available.</div>;

  return (
    <>
      <a className="back-btn" href={`#/${project}/${sessionId}`}>
        &larr; Back to session
      </a>
      <MessageList turns={session.turns} sessionId={sessionId} project={project} isSubAgent />
    </>
  );
}
