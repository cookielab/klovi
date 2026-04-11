import { SubAgentView as UiSubAgentView } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context.ts";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect.ts";
import { kloviHostBridge } from "../../../lib/rpc-client.ts";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

type PackageSubAgentViewProps = {
	sessionId: string;
	project: string;
	agentId: string;
};

export function PackageSubAgentView({ sessionId, project, agentId }: PackageSubAgentViewProps) {
	const runKloviEffect = useRunKloviEffect();
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);
	const turns = data?.session?.turns ?? [];
	const handleLinkClick = useCallback(
		(url: string) => {
			void runKloviEffect(kloviHostBridge.openExternal({ url: url })).catch(() => {});
		},
		[runKloviEffect],
	);

	return (
		<UiSubAgentView
			turns={turns}
			sessionId={sessionId}
			project={project}
			pluginId={data?.session?.pluginId}
			loading={loading}
			error={error ? getRpcErrorMessage(error) : undefined}
			onRetry={retry}
			onLinkClick={handleLinkClick}
			getFrontendPlugin={getFrontendPlugin}
		/>
	);
}
