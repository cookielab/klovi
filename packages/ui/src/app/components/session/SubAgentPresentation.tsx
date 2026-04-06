import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";
import { useSubAgentSessionData } from "../../hooks/useSessionData.ts";
import { PackagePresentationShell } from "./PackagePresentationShell.tsx";

const LOADING_CLASSES = "loading flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle";

type SubAgentPresentationProps = {
	sessionId: string;
	project: string;
	agentId: string;
	onExit: () => void;
};

export function SubAgentPresentation({ sessionId, project, agentId, onExit }: SubAgentPresentationProps) {
	const { data, loading, error, retry } = useSubAgentSessionData(sessionId, project, agentId);

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading sub-agent conversation...</div>;
	}
	if (error) {
		return <TypedErrorDisplay error={error} onRetry={retry} />;
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
