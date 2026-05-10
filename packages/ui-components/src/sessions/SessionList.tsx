import { BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES } from "@cookielab.io/klovi-plugin-core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";
import type { SessionSummary } from "../types/index";
import { FetchError } from "../utilities/FetchError";
import { formatFullDateTime, formatTime } from "../utilities/formatters";

function defaultPluginDisplayName(pluginId: string): string {
	return BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES[pluginId as keyof typeof BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES] ?? pluginId;
}

const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const BACK_BTN_CLASSES =
	"flex cursor-pointer appearance-none items-center gap-[6px] border-0 bg-transparent px-[12px] py-[8px] text-[0.85rem] text-accent hover:underline";
const SECTION_TITLE_CLASSES =
	"px-[12px] pt-[12px] pb-[4px] text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-foreground-subtle";
const LIST_ITEM_BUTTON_CLASSES = "box-border w-full appearance-none border-0 bg-transparent p-0 text-left";
const LIST_ITEM_CLASSES =
	"cursor-pointer px-[12px] py-[10px] transition-[background] duration-100 hover:bg-surface-sunken";
const LIST_ITEM_ACTIVE_CLASSES = "border-l-[3px] border-l-accent bg-accent-subtle";
const LIST_ITEM_PLAN_CLASSES = "border-l-[3px] border-l-plan";
const LIST_ITEM_IMPLEMENTATION_CLASSES = "border-l-[3px] border-l-impl";
const LIST_ITEM_TITLE_CLASSES =
	"overflow-hidden text-[0.85rem] font-medium whitespace-nowrap text-ellipsis text-foreground";
const LIST_ITEM_META_CLASSES = "mt-[2px] text-[0.75rem] text-foreground-subtle";
const PLUGIN_BADGE_CLASSES =
	"inline-block bg-surface-sunken px-[6px] py-[1px] align-middle text-[0.65rem] font-semibold leading-[1.4] uppercase tracking-[0.03em] text-foreground-subtle";
const SESSION_TYPE_BADGE_CLASSES =
	"inline-block px-[6px] py-[1px] align-middle text-[0.65rem] font-semibold leading-[1.4] tracking-[0.02em]";
const SESSION_TYPE_BADGE_PLAN_CLASSES = "bg-plan-subtle text-plan";
const SESSION_TYPE_BADGE_IMPLEMENTATION_CLASSES = "bg-impl-subtle text-impl";
const EMPTY_MESSAGE_CLASSES = "p-[20px] text-center text-[0.85rem] text-foreground-subtle";
const LOADING_CLASSES = "flex items-center justify-center p-[40px] text-[0.9rem] text-foreground-subtle";

const SESSION_ROW_HEIGHT = 56;

type SessionListProps = {
	sessions: SessionSummary[];
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
	selectedId?: string | undefined;
	projectName: string;
	onSelect: (sessionId: string) => void;
	onBack: () => void;
	pluginDisplayName?: ((id: string) => string) | undefined;
};

function SessionItem({
	session,
	isActive,
	onSelect,
	pluginDisplayName,
}: {
	session: SessionSummary;
	isActive: boolean;
	onSelect: (sessionId: string) => void;
	pluginDisplayName: (id: string) => string;
}) {
	const handleClick = useCallback(() => onSelect(session.sessionId), [onSelect, session.sessionId]);

	const itemClasses = [
		LIST_ITEM_BUTTON_CLASSES,
		LIST_ITEM_CLASSES,
		isActive ? LIST_ITEM_ACTIVE_CLASSES : "",
		session.sessionType === "plan" ? LIST_ITEM_PLAN_CLASSES : "",
		session.sessionType === "implementation" ? LIST_ITEM_IMPLEMENTATION_CLASSES : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button type="button" className={itemClasses} onClick={handleClick}>
			<div className={LIST_ITEM_TITLE_CLASSES}>{session.firstMessage || session.slug}</div>
			<div className={LIST_ITEM_META_CLASSES}>
				{session.pluginId ? <span className={PLUGIN_BADGE_CLASSES}>{pluginDisplayName(session.pluginId)}</span> : null}{" "}
				{session.sessionType ? (
					<span
						className={`${SESSION_TYPE_BADGE_CLASSES} ${
							session.sessionType === "plan"
								? SESSION_TYPE_BADGE_PLAN_CLASSES
								: SESSION_TYPE_BADGE_IMPLEMENTATION_CLASSES
						}`}
					>
						{session.sessionType === "plan" ? "Plan" : "Impl"}
					</span>
				) : null}{" "}
				<time dateTime={session.timestamp} title={formatFullDateTime(session.timestamp)}>
					{formatTime(session.timestamp)}
				</time>
			</div>
		</button>
	);
}

function SessionList({
	sessions,
	loading,
	error,
	onRetry,
	selectedId,
	projectName,
	onSelect,
	onBack,
	pluginDisplayName = defaultPluginDisplayName,
}: SessionListProps) {
	const parts = projectName.split("/").filter(Boolean);
	const displayName = parts.slice(-2).join("/");
	const parentRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: sessions.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => SESSION_ROW_HEIGHT,
		overscan: 8,
	});

	if (loading) {
		return <div className={LOADING_CLASSES}>Loading sessions...</div>;
	}
	if (error) {
		return <FetchError error={error} {...(onRetry ? { onRetry: onRetry } : {})} />;
	}

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<button type="button" className={BACK_BTN_CLASSES} onClick={onBack}>
				← Projects
			</button>
			<div className={SECTION_TITLE_CLASSES}>{displayName}</div>
			{sessions.length === 0 ? (
				<div className={EMPTY_MESSAGE_CLASSES}>No sessions found</div>
			) : (
				<div>
					{virtualizer.getVirtualItems().map((item) => {
						const session = sessions[item.index];
						if (!session) {
							return null;
						}
						return (
							<div key={session.sessionId} data-session-id={session.sessionId} data-index={item.index}>
								<SessionItem
									session={session}
									isActive={selectedId === session.sessionId}
									onSelect={onSelect}
									pluginDisplayName={pluginDisplayName}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export type { SessionListProps };
export { SessionList };
