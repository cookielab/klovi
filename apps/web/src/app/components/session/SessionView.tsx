import { FetchError } from "@cookielab.io/klovi-ui/utilities";
import { useSessionData } from "../../hooks/useSessionData.ts";
import { PackageMessageList } from "../message/PackageMessageList.tsx";

interface SessionViewProps {
  sessionId: string;
  project: string;
  gitBranch?: string;
}

export function SessionView({ sessionId, project, gitBranch }: SessionViewProps) {
  const { data, loading, error, retry } = useSessionData(sessionId, project);

  if (loading) return <div className="loading">Loading session...</div>;
  if (error) return <FetchError error={error} onRetry={retry} showPrefix />;
  if (!data?.session) return null;

  const session = data.session;
  return (
    <>
      {gitBranch && (
        <div className="session-branch-bar">
          <span className="session-branch-icon">⎇</span> {gitBranch}
        </div>
      )}
      <PackageMessageList
        turns={session.turns}
        sessionId={sessionId}
        project={project}
        pluginId={session.pluginId}
        planSessionId={session.planSessionId}
        implSessionId={session.implSessionId}
      />
    </>
  );
}
