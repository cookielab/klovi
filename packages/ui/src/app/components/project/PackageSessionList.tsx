import { SessionList as UiSessionList } from "@cookielab.io/klovi-ui-components/sessions";
import { useCallback } from "react";
import { useKloviClient } from "../../../lib/context.ts";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect.ts";
import type { Project, SessionSummary } from "../../../shared/types.ts";
import { useEffectQuery } from "../../hooks/useEffectQuery.ts";
import { pluginDisplayName } from "../../utils/plugin.ts";

type PackageSessionListProps = {
	project: Project;
	onSelect: (session: SessionSummary) => void;
	onBack: () => void;
	selectedId?: string;
};

export function PackageSessionList({ project, onSelect, onBack, selectedId }: PackageSessionListProps) {
	const client = useKloviClient();
	const { data, loading, error, retry } = useEffectQuery<{ sessions: SessionSummary[] }>(
		() => client.getSessions({ encodedPath: project.encodedPath }),
		[client, project.encodedPath],
	);
	const sessions = data?.sessions ?? [];

	const handleSelect = useCallback(
		(sessionId: string) => {
			const session = sessions.find((entry) => entry.sessionId === sessionId);
			if (session) {
				onSelect(session);
			}
		},
		[sessions, onSelect],
	);

	return (
		<UiSessionList
			sessions={sessions}
			loading={loading}
			error={error ? getRpcErrorMessage(error) : undefined}
			onRetry={retry}
			selectedId={selectedId}
			projectName={project.name}
			onSelect={handleSelect}
			onBack={onBack}
			pluginDisplayName={pluginDisplayName}
		/>
	);
}
