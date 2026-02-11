import { useEffect, useState } from "react";
import type { Session } from "../../../shared/types.ts";
import { MessageList } from "../message/MessageList.tsx";

interface SessionViewProps {
  sessionId: string;
  project: string;
}

export function SessionView({ sessionId, project }: SessionViewProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${sessionId}?project=${encodeURIComponent(project)}`)
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
  }, [sessionId, project]);

  if (loading) return <div className="loading">Loading session...</div>;
  if (error)
    return (
      <div className="loading" style={{ color: "var(--error)" }}>
        Error: {error}
      </div>
    );
  if (!session) return null;

  return (
    <MessageList
      turns={session.turns}
      sessionId={sessionId}
      project={project}
      planSessionId={session.planSessionId}
      implSessionId={session.implSessionId}
    />
  );
}
