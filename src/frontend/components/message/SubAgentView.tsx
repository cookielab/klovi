import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { FetchError } from "../ui/FetchError.tsx";
import { MessageList } from "./MessageList.tsx";

interface SubAgentViewProps {
  sessionId: string;
  project: string;
  agentId: string;
}

export function SubAgentView({ sessionId, project, agentId }: SubAgentViewProps) {
  const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);

  if (loading) return <div className="loading">Loading sub-agent conversation...</div>;
  if (error) return <FetchError error={error} onRetry={retry} showPrefix />;
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
