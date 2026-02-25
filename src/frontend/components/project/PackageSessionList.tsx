import { SessionList as UISessionList } from "@cookielab.io/klovi-ui/sessions";
import type { Project, SessionSummary } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";
import { pluginDisplayName } from "../../utils/plugin.ts";

interface PackageSessionListProps {
  project: Project;
  onSelect: (session: SessionSummary) => void;
  onBack: () => void;
  selectedId?: string;
}

export function PackageSessionList({
  project,
  onSelect,
  onBack,
  selectedId,
}: PackageSessionListProps) {
  const { data, loading, error, retry } = useRPC<{ sessions: SessionSummary[] }>(
    () => getRPC().request.getSessions({ encodedPath: project.encodedPath }),
    [project.encodedPath],
  );
  const sessions = data?.sessions ?? [];

  return (
    <UISessionList
      sessions={sessions}
      loading={loading}
      error={error ?? undefined}
      onRetry={retry}
      selectedId={selectedId}
      projectName={project.name}
      onSelect={(sessionId) => {
        const session = sessions.find((entry) => entry.sessionId === sessionId);
        if (session) {
          onSelect(session);
        }
      }}
      onBack={onBack}
      pluginDisplayName={pluginDisplayName}
    />
  );
}
