import { SubAgentView as UISubAgentView } from "@cookielab.io/klovi-ui/messages";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";
import { getRPC } from "../../rpc.ts";

interface PackageSubAgentViewProps {
  sessionId: string;
  project: string;
  agentId: string;
}

function handleLinkClick(url: string): void {
  void getRPC().request.openExternal({ url });
}

export function PackageSubAgentView({ sessionId, project, agentId }: PackageSubAgentViewProps) {
  const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);
  const turns = data?.session?.turns ?? [];

  return (
    <UISubAgentView
      turns={turns}
      sessionId={sessionId}
      project={project}
      pluginId={data?.session?.pluginId}
      loading={loading}
      error={error ?? undefined}
      onRetry={retry}
      onLinkClick={handleLinkClick}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
