import { useSessionData } from "../../hooks/useSessionData.ts";
import { MessageList } from "../message/MessageList.tsx";
import { FetchError } from "../ui/FetchError.tsx";

interface SessionViewProps {
  sessionId: string;
  project: string;
}

export function SessionView({ sessionId, project }: SessionViewProps) {
  const { data, loading, error, retry } = useSessionData(sessionId, project);

  if (loading) return <div className="loading">Loading session...</div>;
  if (error) return <FetchError error={error} onRetry={retry} showPrefix />;
  if (!data?.session) return null;

  const session = data.session;
  return (
    <MessageList
      turns={session.turns}
      sessionId={sessionId}
      project={project}
      pluginId={session.pluginId}
      planSessionId={session.planSessionId}
      implSessionId={session.implSessionId}
    />
  );
}
