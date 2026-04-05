import { Button } from "@cookielab.io/klovi-design-system";
import { useCallback } from "react";
import type { Project } from "../types/index.ts";
import { FetchError } from "../utilities/FetchError.tsx";
import { projectDisplayName } from "./ProjectList.tsx";

const HIDDEN_PROJECTS_PAGE_CLASSES = "mx-auto w-full max-w-[600px] p-[20px]";
const BACK_BTN_CLASSES =
	"flex cursor-pointer appearance-none items-center gap-[6px] border-0 bg-transparent px-[12px] py-[8px] text-[0.85rem] text-accent hover:underline";
const HEADING_CLASSES = "mt-[16px] mb-[12px] text-[1.1rem] text-foreground";
const EMPTY_STATE_CLASSES =
	"flex flex-col items-center justify-center px-[20px] py-[60px] text-center text-foreground-subtle";
const EMPTY_STATE_TITLE_CLASSES = "mb-[8px] text-[1.2rem] font-semibold text-foreground-muted";
const LIST_ITEM_CLASSES =
	"flex cursor-pointer items-center gap-[8px] px-[12px] py-[10px] transition-[background] duration-100 hover:bg-surface-sunken";
const LIST_ITEM_CONTENT_CLASSES = "min-w-0 flex-1";
const LIST_ITEM_TITLE_CLASSES =
	"overflow-hidden text-[0.85rem] font-medium whitespace-nowrap text-ellipsis text-foreground";
const LIST_ITEM_META_CLASSES = "mt-[2px] text-[0.75rem] text-foreground-subtle";
const LOADING_CLASSES = "flex items-center justify-center p-[40px] text-[0.9rem] text-foreground-subtle";

function HiddenProjectItem({ project, onUnhide }: { project: Project; onUnhide: (encodedPath: string) => void }) {
	const handleUnhide = useCallback(() => onUnhide(project.encodedPath), [onUnhide, project.encodedPath]);
	return (
		<div className={LIST_ITEM_CLASSES}>
			<div className={LIST_ITEM_CONTENT_CLASSES}>
				<div className={LIST_ITEM_TITLE_CLASSES}>{projectDisplayName(project)}</div>
				<div className={LIST_ITEM_META_CLASSES}>
					{project.sessionCount} session{project.sessionCount === 1 ? "" : "s"}
				</div>
			</div>
			<Button size="sm" onClick={handleUnhide}>
				Unhide
			</Button>
		</div>
	);
}

export type HiddenProjectListProps = {
	projects: Project[];
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
	hiddenIds: Set<string>;
	onUnhide: (encodedPath: string) => void;
	onBack: () => void;
};

export function HiddenProjectList({
	projects,
	loading,
	error,
	onRetry,
	hiddenIds,
	onUnhide,
	onBack,
}: HiddenProjectListProps) {
	if (loading) {
		return <div className={LOADING_CLASSES}>Loading...</div>;
	}
	if (error) {
		return <FetchError error={error} {...(onRetry ? { onRetry: onRetry } : {})} />;
	}

	const hidden = projects.filter((p) => hiddenIds.has(p.encodedPath));

	return (
		<div className={HIDDEN_PROJECTS_PAGE_CLASSES}>
			<button type="button" className={BACK_BTN_CLASSES} onClick={onBack}>
				← Back to projects
			</button>
			<h2 className={HEADING_CLASSES}>Hidden Projects</h2>
			{hidden.length === 0 ? (
				<div className={EMPTY_STATE_CLASSES}>
					<div className={EMPTY_STATE_TITLE_CLASSES}>No hidden projects</div>
					<p>Projects you hide will appear here</p>
				</div>
			) : (
				hidden.map((project) => <HiddenProjectItem key={project.encodedPath} project={project} onUnhide={onUnhide} />)
			)}
		</div>
	);
}
