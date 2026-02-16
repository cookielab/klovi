import type { Session } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
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
  const { data, loading, error, retry } = useFetch<{ session: Session }>(
    `/api/sessions/${sessionId}/subagents/${agentId}?project=${encodeURIComponent(project)}`,
    [sessionId, project, agentId],
  );

  if (loading) return <div className="loading">Loading sub-agent conversation...</div>;
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
  if (!data?.session || data.session.turns.length === 0) return null;

  return (
    <PresentationShell
      turns={data.session.turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
      isSubAgent
    />
  );
}
