import { Button } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { useCallback } from "react";
import type { Project } from "../types/index.ts";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters.ts";
import styles from "./ProjectList.module.css";

function s(name: string | undefined): string {
	return name ?? "";
}

const PATH_SEPARATOR_REGEX = /[/\\]/u;

function projectDisplayName(project: Project): string {
	const parts = project.name.split(PATH_SEPARATOR_REGEX).filter(Boolean);
	return parts.slice(-2).join("/");
}

type ProjectListProps = {
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

function ProjectItem({
	project,
	isActive,
	onSelect,
	onHide,
}: {
	project: Project;
	isActive: boolean;
	onSelect: (encodedPath: string) => void;
	onHide: (encodedPath: string) => void;
}) {
	const handleClick = useCallback(() => onSelect(project.encodedPath), [onSelect, project.encodedPath]);
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onSelect(project.encodedPath);
			}
		},
		[onSelect, project.encodedPath],
	);
	const handleHide = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onHide(project.encodedPath);
		},
		[onHide, project.encodedPath],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: contains nested button, cannot be a <button>
		<div
			className={`${s(styles["listItem"])} ${isActive ? s(styles["listItemActive"]) : ""}`}
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			<div className={s(styles["listItemContent"])}>
				<div className={s(styles["listItemTitle"])}>{projectDisplayName(project)}</div>
				<div className={s(styles["listItemMeta"])}>
					{project.sessionCount} session{project.sessionCount === 1 ? "" : "s"} ·{" "}
					<time dateTime={project.lastActivity} title={formatFullDateTime(project.lastActivity)}>
						{formatRelativeTime(project.lastActivity)}
					</time>
				</div>
			</div>
			<button type="button" className={s(styles["btnHide"])} title="Hide project" onClick={handleHide}>
				×
			</button>
		</div>
	);
}

function ProjectList({
	projects,
	loading,
	error,
	onRetry,
	selectedId,
	hiddenIds,
	onSelect,
	onHide,
	onShowHidden,
	filter = "",
	onFilterChange,
}: ProjectListProps) {
	const handleFilterChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onFilterChange?.(e.target.value),
		[onFilterChange],
	);

	if (loading) {
		return <div className={s(styles["loading"])}>Loading projects...</div>;
	}
	if (error) {
		return (
			<div className={s(styles["fetchError"])}>
				<span className={s(styles["fetchErrorMessage"])}>{error}</span>
				{onRetry ? (
					<Button size="sm" onClick={onRetry}>
						Retry
					</Button>
				) : null}
			</div>
		);
	}

	const filtered = projects.filter(
		(p) =>
			!hiddenIds.has(p.encodedPath) &&
			(p.name.toLowerCase().includes(filter.toLowerCase()) ||
				p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
	);

	return (
		<div>
			<input
				className={s(styles["filterInput"])}
				placeholder="Filter projects..."
				value={filter}
				onChange={handleFilterChange}
			/>
			<div className={s(styles["sectionTitle"])}>Projects ({filtered.length})</div>
			{filtered.map((project) => (
				<ProjectItem
					key={project.encodedPath}
					project={project}
					isActive={selectedId === project.encodedPath}
					onSelect={onSelect}
					onHide={onHide}
				/>
			))}
			{filtered.length === 0 && <div className={s(styles["emptyMessage"])}>No projects found</div>}
			{hiddenIds.size > 0 && (
				<button type="button" className={s(styles["hiddenProjectsLink"])} onClick={onShowHidden}>
					{hiddenIds.size} hidden project{hiddenIds.size === 1 ? "" : "s"}
				</button>
			)}
		</div>
	);
}

// biome-ignore lint/style/useComponentExportOnlyModules: type-only export for component props
export type { ProjectListProps };
// biome-ignore lint/style/useComponentExportOnlyModules: co-located utility used by consumers alongside the component
export { ProjectList, projectDisplayName };
