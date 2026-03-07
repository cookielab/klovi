import { SubAgentView as UISubAgentView } from "@cookielab.io/klovi-ui/messages";
import { useKloviHostBridge } from "../../../lib/context.ts";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

interface PackageSubAgentViewProps {
  sessionId: string;
  project: string;
  agentId: string;
}

export function PackageSubAgentView({ sessionId, project, agentId }: PackageSubAgentViewProps) {
  const hostBridge = useKloviHostBridge();
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
      onLinkClick={(url: string) => void hostBridge.openExternal({ url })}
      getFrontendPlugin={getFrontendPlugin}
    />
  );
}
