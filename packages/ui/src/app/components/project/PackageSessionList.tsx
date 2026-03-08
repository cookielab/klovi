import { SessionList as UISessionList } from "@cookielab.io/klovi-ui-components/sessions";
import { useKloviClient } from "../../../lib/context.ts";
import type { Project, SessionSummary } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
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
  const client = useKloviClient();
  const { data, loading, error, retry } = useRPC<{ sessions: SessionSummary[] }>(
    () => client.getSessions({ encodedPath: project.encodedPath }),
    [client, project.encodedPath],
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
