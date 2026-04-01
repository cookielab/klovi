import { TurnBox } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { Turn } from "../types/index.ts";
import { ErrorBoundary, formatFullDateTime, formatTimestamp } from "../utilities/index.ts";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import styles from "./MessageList.module.css";
import { UserMessage } from "./UserMessage.tsx";

function s(name: string | undefined): string {
	return name ?? "";
}

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
	const activeClass = options.isActive ? s(styles["activeMessage"]) : "";

	switch (options.turn.kind) {
		case "user":
			return (
				<div className={options.isActive ? `${s(styles["activeMessage"])} ${s(styles["stepEnter"])}` : ""}>
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
								<span className={s(styles["parseErrorLine"])}>line {options.turn.lineNumber}</span>
							) : undefined
						}
					>
						<div className={s(styles["parseErrorType"])}>
							{options.turn.errorType === "json_parse" ? "Invalid JSON" : "Invalid Structure"}
						</div>
						{options.turn.errorDetails ? (
							<div className={s(styles["parseErrorDetails"])}>{options.turn.errorDetails}</div>
						) : null}
						<details className={s(styles["parseErrorRaw"])}>
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
	const firstUserTurnIndex = turns.findIndex((t) => {
		if (t.kind !== "user") {
			return false;
		}
		return !STATUS_RE.test(t.text.trim());
	});

	return (
		<div className={s(styles["messageList"])}>
			{turns.map((turn, index) => {
				const isActive = visibleSubSteps ? index === turns.length - 1 : false;
				return (
					<ErrorBoundary key={turn.uuid || index} inline={true}>
						{renderTurn({
							turn: turn,
							index: index,
							isActive: isActive,
							visibleSubSteps: visibleSubSteps,
							sessionId: sessionId,
							project: project,
							pluginId: pluginId,
							isSubAgent: isSubAgent,
							planSessionId: planSessionId,
							implSessionId: index === firstUserTurnIndex ? implSessionId : undefined,
							onSessionLink: onSessionLink,
							onLinkClick: onLinkClick,
							getFrontendPlugin: getFrontendPlugin,
						})}
					</ErrorBoundary>
				);
			})}
		</div>
	);
}
