import { FetchError } from "@cookielab.io/klovi-ui-components/utilities";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { PackagePresentationShell } from "./PackagePresentationShell.tsx";

type SubAgentPresentationProps = {
	sessionId: string;
	project: string;
	agentId: string;
	onExit: () => void;
};

export function SubAgentPresentation({ sessionId, project, agentId, onExit }: SubAgentPresentationProps) {
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);

	if (loading) {
		return <div className="loading">Loading sub-agent conversation...</div>;
	}
	if (error) {
		return <FetchError error={error} onRetry={retry} showPrefix={true} />;
	}
	if (!data?.session || data.session.turns.length === 0) {
		return null;
	}

	return (
		<PackagePresentationShell
			turns={data.session.turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			pluginId={data.session.pluginId}
			isSubAgent={true}
		/>
	);
}
