import { TurnBox } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import type { Turn } from "../types/index.ts";
import { ErrorBoundary, formatFullDateTime, formatTimestamp } from "../utilities/index.ts";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { UserMessage } from "./UserMessage.tsx";

const STEP_FADE_IN_KEYFRAMES =
	"@keyframes stepFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }";

const STEP_ENTER_CLASSES = "animate-[stepFadeIn_0.3s_ease_forwards]";
const PARSE_ERROR_LINE_CLASSES = "ml-2 text-[0.8em] font-normal text-foreground-muted";
const PARSE_ERROR_TYPE_CLASSES = "inline-block mb-1 text-[0.8em] font-semibold text-error";
const PARSE_ERROR_DETAILS_CLASSES = "mb-1 text-[0.85em] text-foreground-muted font-mono";
const PARSE_ERROR_RAW_CLASSES =
	"mt-2 [&>summary]:text-[0.8em] [&>summary]:text-foreground-subtle [&>summary]:cursor-pointer [&>summary]:select-none [&>pre]:mt-1 [&>pre]:p-2 [&>pre]:bg-surface-sunken [&>pre]:text-[0.8em] [&>pre]:overflow-x-auto [&>pre]:whitespace-pre-wrap [&>pre]:break-all";

type MessageListProps = {
	turns: Turn[];
	visibleSubSteps?: Map<number, number> | undefined;
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	isSubAgent?: boolean | undefined;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
	onSessionLink?: ((sessionId: string) => void) | undefined;
	onLinkClick?: ((url: string) => void) | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
};

type RenderTurnOptions = {
	turn: Turn;
	index: number;
	isActive: boolean;
	visibleSubSteps: Map<number, number> | undefined;
	sessionId: string | undefined;
	project: string | undefined;
	pluginId: string | undefined;
	isSubAgent: boolean | undefined;
	planSessionId: string | undefined;
	implSessionId: string | undefined;
	onSessionLink: ((targetSessionId: string) => void) | undefined;
	onLinkClick: ((url: string) => void) | undefined;
	getFrontendPlugin: ((id: string) => FrontendPlugin | undefined) | undefined;
};

function renderTurn(options: RenderTurnOptions) {
	const activeClass = options.isActive ? "active-message" : "";

	switch (options.turn.kind) {
		case "user":
			return (
				<div className={options.isActive ? `active-message ${STEP_ENTER_CLASSES}` : ""}>
					<UserMessage
						turn={options.turn}
						isSubAgent={options.isSubAgent}
						planSessionId={options.planSessionId}
						implSessionId={options.implSessionId}
						project={options.project}
						onSessionLink={options.onSessionLink}
						onLinkClick={options.onLinkClick}
					/>
				</div>
			);
		case "assistant":
			return (
				<div className={activeClass}>
					<AssistantMessage
						turn={options.turn}
						visibleSubSteps={options.visibleSubSteps?.get(options.index)}
						sessionId={options.sessionId}
						project={options.project}
						pluginId={options.pluginId}
						onLinkClick={options.onLinkClick}
						getFrontendPlugin={options.getFrontendPlugin}
					/>
				</div>
			);
		case "system":
			return (
				<div className={activeClass}>
					{/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
					<TurnBox
						role="system"
						timestamp={
							options.turn.timestamp ? (
								<time dateTime={options.turn.timestamp} data-tooltip={formatFullDateTime(options.turn.timestamp)}>
									{formatTimestamp(options.turn.timestamp)}
								</time>
							) : undefined
						}
					>
						<MarkdownRenderer content={options.turn.text} onLinkClick={options.onLinkClick} />
					</TurnBox>
				</div>
			);
		case "parse_error":
			return (
				<div className={activeClass}>
					{/* biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role */}
					<TurnBox
						role="error"
						badge="Parse Error"
						timestamp={
							options.turn.lineNumber > 0 ? (
								<span className={PARSE_ERROR_LINE_CLASSES}>line {options.turn.lineNumber}</span>
							) : undefined
						}
					>
						<div className={PARSE_ERROR_TYPE_CLASSES}>
							{options.turn.errorType === "json_parse" ? "Invalid JSON" : "Invalid Structure"}
						</div>
						{options.turn.errorDetails ? (
							<div className={PARSE_ERROR_DETAILS_CLASSES}>{options.turn.errorDetails}</div>
						) : null}
						<details className={PARSE_ERROR_RAW_CLASSES}>
							<summary>Raw content</summary>
							<pre>{options.turn.rawLine}</pre>
						</details>
					</TurnBox>
				</div>
			);
		default:
			return null;
	}
}

const STATUS_RE = /^\[.+\]$/u;

const SCROLL_CONTAINER_CLASSES = "h-full w-full overflow-auto";
const SCROLL_INNER_CLASSES = "relative w-full mx-auto max-w-[900px] p-5";

const ESTIMATED_TURN_HEIGHT = 200;

export function MessageList({
	turns,
	visibleSubSteps,
	sessionId,
	project,
	pluginId,
	isSubAgent,
	planSessionId,
	implSessionId,
	onSessionLink,
	onLinkClick,
	getFrontendPlugin,
}: MessageListProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const firstUserTurnIndex = useMemo(
		() =>
			turns.findIndex((t) => {
				if (t.kind !== "user") {
					return false;
				}
				return !STATUS_RE.test(t.text.trim());
			}),
		[turns],
	);

	const virtualizer = useVirtualizer({
		count: turns.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ESTIMATED_TURN_HEIGHT,
		overscan: 5,
		measureElement: (el) => el.getBoundingClientRect().height,
	});

	const totalSize = virtualizer.getTotalSize();
	const items = virtualizer.getVirtualItems();

	const previousCountRef = useRef(turns.length);
	useEffect(() => {
		const previous = previousCountRef.current;
		if (turns.length > previous && parentRef.current) {
			// Append happened (e.g., §3b tail). Preserve current scrollTop so the user
			// is not jumped by the layout-size change.
			const offset = parentRef.current.scrollTop;
			// Wait for layout to flush, then restore.
			requestAnimationFrame(() => {
				if (parentRef.current) {
					parentRef.current.scrollTop = offset;
				}
			});
		}
		previousCountRef.current = turns.length;
	}, [turns.length]);

	useEffect(() => {
		if (!visibleSubSteps) {
			return;
		}
		const lastIndex = turns.length - 1;
		if (lastIndex < 0) {
			return;
		}
		virtualizer.scrollToIndex(lastIndex, { align: "center" });
	}, [visibleSubSteps, turns.length, virtualizer]);

	return (
		<div ref={parentRef} className={SCROLL_CONTAINER_CLASSES}>
			<style>{STEP_FADE_IN_KEYFRAMES}</style>
			{/* biome-ignore lint/nursery/noInlineStyles: required by react-virtual for absolute positioning */}
			<div className={SCROLL_INNER_CLASSES} style={{ height: totalSize }}>
				{items.map((item) => {
					const turn = turns[item.index];
					if (!turn) {
						return null;
					}
					const isActive = visibleSubSteps ? item.index === turns.length - 1 : false;
					return (
						<div
							key={turn.uuid || item.index}
							ref={virtualizer.measureElement}
							data-index={item.index}
							// biome-ignore lint/nursery/noInlineStyles: required by react-virtual for absolute positioning
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${item.start}px)`,
							}}
						>
							<ErrorBoundary inline={true}>
								{renderTurn({
									turn: turn,
									index: item.index,
									isActive: isActive,
									visibleSubSteps: visibleSubSteps,
									sessionId: sessionId,
									project: project,
									pluginId: pluginId,
									isSubAgent: isSubAgent,
									planSessionId: planSessionId,
									implSessionId: item.index === firstUserTurnIndex ? implSessionId : undefined,
									onSessionLink: onSessionLink,
									onLinkClick: onLinkClick,
									getFrontendPlugin: getFrontendPlugin,
								})}
							</ErrorBoundary>
						</div>
					);
				})}
			</div>
		</div>
	);
}
