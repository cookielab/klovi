import type { Session } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
import { MessageList } from "./MessageList.tsx";

interface SubAgentViewProps {
  sessionId: string;
  project: string;
  agentId: string;
}

export function SubAgentView({ sessionId, project, agentId }: SubAgentViewProps) {
  const { data, loading, error, retry } = useFetch<{ session: Session }>(
    `/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}?project=${encodeURIComponent(project)}`,
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
  if (!data?.session || data.session.turns.length === 0)
    return <div className="subagent-empty">No sub-agent conversation data available.</div>;

  return (
    <MessageList
      turns={data.session.turns}
      sessionId={sessionId}
      project={project}
      pluginId={data.session.pluginId}
      isSubAgent
    />
  );
}
