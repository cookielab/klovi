import { SubAgentView as UiSubAgentView } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect";
import { useSubAgentSessionData } from "../../hooks/useSessionData";

type PackageSubAgentViewProps = {
	sessionId: string;
	project: string;
	agentId: string;
};

export function PackageSubAgentView({ sessionId, project, agentId }: PackageSubAgentViewProps): React.ReactNode {
	const runKloviEffect = useRunKloviEffect();
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);
	const turns = data?.session?.turns ?? [];
	const handleLinkClick = useCallback(
		(url: string) => {
			runKloviEffect(kloviHostBridge.openExternal({ url: url })).catch(() => undefined);
		},
		[runKloviEffect],
	);

	return (
		<UiSubAgentView
			turns={turns}
			sessionId={sessionId}
			project={project}
			loading={loading}
			error={error ? getRpcErrorMessage(error) : undefined}
			onRetry={retry}
			onLinkClick={handleLinkClick}
		/>
	);
}
