import { ProjectList as UiProjectList } from "@cookielab.io/klovi-ui-components/sessions";
import { useCallback, useState } from "react";
import { useKloviClient } from "../../../lib/context.ts";
import type { Project } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";

type PackageProjectListProps = {
	onSelect: (project: Project) => void;
	selected?: string;
	hiddenIds: Set<string>;
	onHide: (encodedPath: string) => void;
	onShowHidden: () => void;
};

export function PackageProjectList({ onSelect, selected, hiddenIds, onHide, onShowHidden }: PackageProjectListProps) {
	const client = useKloviClient();
	const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(() => client.getProjects(), [client]);
	const [filter, setFilter] = useState("");
	const projects = data?.projects ?? [];

	const handleSelect = useCallback(
		(encodedPath: string) => {
			const project = projects.find((entry) => entry.encodedPath === encodedPath);
			if (project) {
				onSelect(project);
			}
		},
		[projects, onSelect],
	);

	return (
		<UiProjectList
			projects={projects}
			loading={loading}
			error={error ?? undefined}
			onRetry={retry}
			selectedId={selected}
			hiddenIds={hiddenIds}
			onSelect={handleSelect}
			onHide={onHide}
			onShowHidden={onShowHidden}
			filter={filter}
			onFilterChange={setFilter}
		/>
	);
}
