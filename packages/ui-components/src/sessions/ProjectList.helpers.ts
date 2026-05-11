import type { Project } from "../types/index";

const PATH_SEPARATOR_REGEX = /[/\\]/u;

export type ProjectListProps = {
	projects: Project[];
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
	selectedId?: string | undefined;
	hiddenIds: Set<string>;
	onSelect: (encodedPath: string) => void;
	onHide: (encodedPath: string) => void;
	onShowHidden: () => void;
	filter?: string | undefined;
	onFilterChange?: ((filter: string) => void) | undefined;
};

export function projectDisplayName(project: Project): string {
	const parts = project.name.split(PATH_SEPARATOR_REGEX).filter(Boolean);
	return parts.slice(-2).join("/");
}
