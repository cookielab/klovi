import { useSessionData } from "../../hooks/useSessionData.ts";
import { PackageMessageList } from "../message/PackageMessageList.tsx";
import { TypedErrorDisplay } from "../ui/TypedErrorDisplay.tsx";

const LOADING_CLASSES = "loading flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle";
const BRANCH_BAR_CLASSES =
	"mx-auto w-full max-w-[900px] border-border-muted border-b px-5 py-[6px] font-mono text-[0.75rem] text-foreground-subtle";
const BRANCH_ICON_CLASSES = "text-[0.8rem]";

type SessionViewProps = {
	sessionId: string;
	project: string;
	gitBranch?: string;
};

export function SessionView({ sessionId, project, gitBranch }: SessionViewProps) {
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

	const { session } = data;
	return (
		<>
			{gitBranch ? (
				<div className={BRANCH_BAR_CLASSES}>
					<span className={BRANCH_ICON_CLASSES}>⎇</span> {gitBranch}
				</div>
			) : null}
			<PackageMessageList
				turns={session.turns}
				sessionId={sessionId}
				project={project}
				pluginId={session.pluginId}
				planSessionId={session.planSessionId}
				implSessionId={session.implSessionId}
			/>
		</>
	);
}
