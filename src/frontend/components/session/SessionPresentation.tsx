import { useSessionData } from "../../hooks/useSessionData.ts";
import { PresentationShell } from "./PresentationShell.tsx";

interface SessionPresentationProps {
  sessionId: string;
  project: string;
  onExit: () => void;
}

export function SessionPresentation({ sessionId, project, onExit }: SessionPresentationProps) {
  const { data, loading, error, retry } = useSessionData(sessionId, project);

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

  return (
    <PresentationShell
      turns={data.session.turns}
      onExit={onExit}
      sessionId={sessionId}
      project={project}
      pluginId={data.session.pluginId}
    />
  );
}
