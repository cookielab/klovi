import type { Session } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
import { MessageList } from "../message/MessageList.tsx";

interface SessionViewProps {
  sessionId: string;
  project: string;
}

export function SessionView({ sessionId, project }: SessionViewProps) {
  const { data, loading, error, retry } = useFetch<{ session: Session }>(
    `/api/sessions/${encodeURIComponent(sessionId)}?project=${encodeURIComponent(project)}`,
    [sessionId, project],
  );

  if (loading) return <div className="loading">Loading session...</div>;
  if (error) {
    return (
      <div className="fetch-error">
        <span className="fetch-error-message">Error: {error}</span>
        <button type="button" className="btn btn-sm" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }
  if (!data?.session) return null;

  const session = data.session;
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
