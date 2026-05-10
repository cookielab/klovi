import { Button, Text } from "@cookielab.io/klovi-design-system";
import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { useCallback, useRef } from "react";
import type { Project } from "../types/index";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters";


const T_SESSION = "session";
const T_SP_1 = " ";
const T_TEXT = "·";
const T_TEXT_2 = "×";
const T_LOADING_PROJECTS = "Loading projects...";
const T_RETRY = "Retry";
const T_PROJECTS = "Projects (";
const T_TEXT_3 = ")";
const T_NO_PROJECTS_FOUND = "No projects found";
const T_HIDDEN_PROJECT = "hidden project";

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
}): React.ReactNode {
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
					{project.sessionCount}<Text>{T_SP_1}</Text><Text>{T_SESSION}</Text>{project.sessionCount === 1 ? "" : "s"}<Text>{T_SP_1}</Text><Text>{T_TEXT}</Text><Text>{T_SP_1}</Text>
					<time dateTime={project.lastActivity} title={formatFullDateTime(project.lastActivity)}>
						{formatRelativeTime(project.lastActivity)}
					</time>
				</div>
			</div>
			<button type="button" className={BTN_HIDE_CLASSES} title="Hide project" onClick={handleHide}>
				<Text>{T_TEXT_2}</Text>
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
}: ProjectListProps): React.ReactNode {
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
		return <div className={LOADING_CLASSES}><Text>{T_LOADING_PROJECTS}</Text></div>;
	}
	if (error) {
		return (
			<div className={FETCH_ERROR_CLASSES}>
				<span className={FETCH_ERROR_MESSAGE_CLASSES}>{error}</span>
				{onRetry ? (
					<Button size="sm" onClick={onRetry}>
						<Text>{T_RETRY}</Text>
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
			<div className={SECTION_TITLE_CLASSES}><Text>{T_PROJECTS}</Text>{filtered.length}<Text>{T_TEXT_3}</Text></div>
			{filtered.length === 0 ? (
				<div className={EMPTY_MESSAGE_CLASSES}><Text>{T_NO_PROJECTS_FOUND}</Text></div>
			) : (
				<div>
					{virtualizer.getVirtualItems().map((item) => {
						const project = filtered[item.index];
						if (!project) {
							return null;
						}
						return (
							<div key={project.encodedPath} data-project-encoded-path={project.encodedPath} data-index={item.index}>
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
					{hiddenIds.size}<Text>{T_SP_1}</Text><Text>{T_HIDDEN_PROJECT}</Text>{hiddenIds.size === 1 ? "" : "s"}
				</button>
			)}
		</div>
	);
}

export type { ProjectListProps };
export { ProjectList, projectDisplayName };
