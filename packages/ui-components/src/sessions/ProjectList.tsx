import { Button } from "@cookielab.io/klovi-design-system";
import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { useCallback, useRef } from "react";
import type { Project } from "../types/index.ts";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters.ts";

const PATH_SEPARATOR_REGEX = /[/\\]/u;

function projectDisplayName(project: Project): string {
	const parts = project.name.split(PATH_SEPARATOR_REGEX).filter(Boolean);
	return parts.slice(-2).join("/");
}

const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const FILTER_INPUT_CLASSES =
	"mb-[8px] w-full border border-border bg-surface px-[12px] py-[8px] text-[0.85rem] text-foreground outline-none focus:border-accent";
const SECTION_TITLE_CLASSES =
	"px-[12px] pt-[12px] pb-[4px] text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-foreground-subtle";
const LIST_ITEM_BASE_CLASSES =
	"group flex cursor-pointer items-center gap-[8px] px-[12px] py-[10px] transition-[background] duration-100 hover:bg-surface-sunken";
const LIST_ITEM_ACTIVE_CLASSES = "border-l-[3px] border-l-accent bg-accent-subtle";
const LIST_ITEM_CONTENT_CLASSES = "min-w-0 flex-1";
const LIST_ITEM_TITLE_CLASSES =
	"overflow-hidden text-[0.85rem] font-medium whitespace-nowrap text-ellipsis text-foreground";
const LIST_ITEM_META_CLASSES = "mt-[2px] text-[0.75rem] text-foreground-subtle";
const BTN_HIDE_CLASSES =
	"flex-shrink-0 cursor-pointer border-none bg-transparent px-[6px] py-[2px] text-[1.1rem] text-foreground-subtle opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-error";
const HIDDEN_PROJECTS_LINK_CLASSES =
	"block w-full cursor-pointer appearance-none border-0 bg-transparent p-[12px] text-center text-[0.8rem] text-foreground-subtle hover:underline";
const EMPTY_MESSAGE_CLASSES = "p-[20px] text-center text-[0.85rem] text-foreground-subtle";
const LOADING_CLASSES = "flex items-center justify-center p-[40px] text-[0.9rem] text-foreground-subtle";
const FETCH_ERROR_CLASSES =
	"flex flex-col items-center justify-center gap-[12px] p-[40px] text-[0.9rem] text-foreground-muted";
const FETCH_ERROR_MESSAGE_CLASSES = "text-error";

const PROJECT_ROW_HEIGHT = 56;

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
			className={`${LIST_ITEM_BASE_CLASSES} ${isActive ? LIST_ITEM_ACTIVE_CLASSES : ""}`}
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			<div className={LIST_ITEM_CONTENT_CLASSES}>
				<div className={LIST_ITEM_TITLE_CLASSES}>{projectDisplayName(project)}</div>
				<div className={LIST_ITEM_META_CLASSES}>
					{project.sessionCount} session{project.sessionCount === 1 ? "" : "s"} ·{" "}
					<time dateTime={project.lastActivity} title={formatFullDateTime(project.lastActivity)}>
						{formatRelativeTime(project.lastActivity)}
					</time>
				</div>
			</div>
			<button type="button" className={BTN_HIDE_CLASSES} title="Hide project" onClick={handleHide}>
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
	const parentRef = useRef<HTMLDivElement>(null);

	// Compute the filtered list eagerly so the virtualizer always sees a count.
	// Returning [] when loading/error keeps useVirtualizer call order stable across renders.
	const filtered =
		loading || error
			? []
			: projects.filter(
					(p) =>
						!hiddenIds.has(p.encodedPath) &&
						(p.name.toLowerCase().includes(filter.toLowerCase()) ||
							p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
				);

	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => PROJECT_ROW_HEIGHT,
		overscan: 8,
	});

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading projects...</div>;
	}
	if (error) {
		return (
			<div className={FETCH_ERROR_CLASSES}>
				<span className={FETCH_ERROR_MESSAGE_CLASSES}>{error}</span>
				{onRetry ? (
					<Button size="sm" onClick={onRetry}>
						Retry
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<input
				className={FILTER_INPUT_CLASSES}
				placeholder="Filter projects..."
				value={filter}
				onChange={handleFilterChange}
			/>
			<div className={SECTION_TITLE_CLASSES}>Projects ({filtered.length})</div>
			{filtered.length === 0 ? (
				<div className={EMPTY_MESSAGE_CLASSES}>No projects found</div>
			) : (
				// biome-ignore lint/nursery/noInlineStyles: required by react-virtual for absolute positioning
				<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
					{virtualizer.getVirtualItems().map((item) => {
						const project = filtered[item.index];
						if (!project) {
							return null;
						}
						return (
							<div
								key={project.encodedPath}
								data-project-encoded-path={project.encodedPath}
								data-index={item.index}
								// biome-ignore lint/nursery/noInlineStyles: required by react-virtual for absolute positioning
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									transform: `translateY(${item.start}px)`,
								}}
							>
								<ProjectItem
									project={project}
									isActive={selectedId === project.encodedPath}
									onSelect={onSelect}
									onHide={onHide}
								/>
							</div>
						);
					})}
				</div>
			)}
			{hiddenIds.size > 0 && (
				<button type="button" className={HIDDEN_PROJECTS_LINK_CLASSES} onClick={onShowHidden}>
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
