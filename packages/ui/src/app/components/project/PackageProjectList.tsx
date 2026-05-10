import { ProjectList as UiProjectList } from "@cookielab.io/klovi-ui-components/sessions";
import { useCallback, useState } from "react";
import { useKloviClient } from "../../../lib/context";
import { getRpcErrorMessage } from "../../../lib/rpc-errors-effect";
import type { Project } from "../../../shared/types";
import { useEffectQuery } from "../../hooks/useEffectQuery";

type PackageProjectListProps = {
	onSelect: (project: Project) => void;
	selected?: string;
	hiddenIds: Set<string>;
	onHide: (encodedPath: string) => void;
	onShowHidden: () => void;
};

export function PackageProjectList({ onSelect, selected, hiddenIds, onHide, onShowHidden }: PackageProjectListProps) {
	const client = useKloviClient();
	const { data, loading, error, retry } = useEffectQuery<{ projects: Project[] }>(() => client.getProjects(), [client]);
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
			error={error ? getRpcErrorMessage(error) : undefined}
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
