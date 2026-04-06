import { SubAgentView as UiSubAgentView } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useKloviHostBridge } from "../../../lib/context.ts";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

type PackageSubAgentViewProps = {
	sessionId: string;
	project: string;
	agentId: string;
};

export function PackageSubAgentView({ sessionId, project, agentId }: PackageSubAgentViewProps) {
	const hostBridge = useKloviHostBridge();
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);
	const turns = data?.session?.turns ?? [];
	const handleLinkClick = useCallback(
		(url: string) => {
			hostBridge.openExternal({ url: url }).catch(() => {});
		},
		[hostBridge],
	);

	return (
		<UiSubAgentView
			turns={turns}
			sessionId={sessionId}
			project={project}
			pluginId={data?.session?.pluginId}
			loading={loading}
			error={error?.message}
			onRetry={retry}
			onLinkClick={handleLinkClick}
			getFrontendPlugin={getFrontendPlugin}
		/>
	);
}
