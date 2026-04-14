import { useSessionData } from "../../hooks/useSessionData.ts";
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";
import { PackagePresentationShell } from "./PackagePresentationShell.tsx";

const LOADING_CLASSES = "loading flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle";

type SessionPresentationProps = {
	sessionId: string;
	project: string;
	onExit: () => void;
};

export function SessionPresentation({ sessionId, project, onExit }: SessionPresentationProps) {
	const { data, loading, error, retry } = useSessionData(sessionId, project);

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading session...</div>;
	}
	if (error) {
		return <TypedErrorDisplay error={error} onRetry={retry} />;
	}
	if (!data?.session) {
		return null;
	}

	return (
		<PackagePresentationShell
			turns={data.session.turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			pluginId={data.session.pluginId}
		/>
	);
}
