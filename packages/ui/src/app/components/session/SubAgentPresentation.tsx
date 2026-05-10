import { Text } from "@cookielab.io/klovi-design-system";
import { useSubAgentSessionData } from "../../hooks/useSessionData";
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay";
import { PackagePresentationShell } from "./PackagePresentationShell";


const T_LOADING_SUB_AGENT_CONVERSATION = "Loading sub-agent conversation...";

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
		return <div className={LOADING_CLASSES}><Text>{T_LOADING_SUB_AGENT_CONVERSATION}</Text></div>;
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
