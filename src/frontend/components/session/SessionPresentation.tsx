import { useSessionData } from "../../hooks/useSessionData.ts";
import { FetchError } from "../ui/FetchError.tsx";
import { PresentationShell } from "./PresentationShell.tsx";

interface SessionPresentationProps {
  sessionId: string;
  project: string;
  onExit: () => void;
}

export function SessionPresentation({ sessionId, project, onExit }: SessionPresentationProps) {
  const { data, loading, error, retry } = useSessionData(sessionId, project);

  if (loading) return <div className="loading">Loading session...</div>;
  if (error) return <FetchError error={error} onRetry={retry} showPrefix />;
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
