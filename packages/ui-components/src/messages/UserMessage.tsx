import { Text, TurnBox } from "@cookielab.io/klovi-design-system";
import type React from "react";
import type { UserTurn } from "../types/index";
import { formatFullDateTime, formatTimestamp } from "../utilities/index";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { UserBashContent } from "./UserBashContent";


const T_OPENED = "Opened";
const T_SP_1 = " ";
const T_SKILL = "skill";
const T_IMAGE = "image/";

const IMAGE_MEDIA_TYPE_PREFIX_REGEX = /^image\//u;
const STATUS_RE = /^\[.+\]$/u;
const PLAN_PREFIX = "Implement the following plan";

const STATUS_NOTICE_CLASSES = "py-1 mb-4 text-center text-[0.75rem] text-foreground-subtle italic";
const IDE_OPENED_FILE_NOTICE_CLASSES = `${STATUS_NOTICE_CLASSES} not-italic`;
const IDE_OPENED_FILE_PATH_CLASSES = "bg-transparent p-0 text-[0.75rem] text-foreground-muted font-mono";
const COMMAND_CALL_CLASSES = "flex items-baseline gap-[6px] mb-1 text-[0.8rem] text-foreground-subtle";
const COMMAND_CALL_LABEL_CLASSES = "font-semibold text-accent";
const SKILL_BADGE_CLASSES =
	"inline-block px-[6px] py-[1px] mr-[6px] bg-accent/15 text-[0.7rem] font-semibold text-accent uppercase tracking-[0.03em]";
const ATTACHMENTS_CLASSES = "flex flex-wrap gap-[6px] mt-[10px]";
const ATTACHMENT_BADGE_CLASSES =
	"inline-block px-[10px] py-[3px] border border-accent bg-accent-subtle text-[0.75rem] font-semibold text-accent";
const SESSION_LINK_CLASSES =
	"ml-[10px] text-[0.75rem] font-[inherit] font-medium text-accent no-underline opacity-80 hover:underline hover:opacity-100";

type UserMessageProps = {
	turn: UserTurn;
	isSubAgent?: boolean | undefined;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
	project?: string | undefined;
	onSessionLink?: ((sessionId: string) => void) | undefined;
	onLinkClick?: ((url: string) => void) | undefined;
};

function TimestampLabel({ timestamp }: { timestamp: string }) {
	return (
		<time dateTime={timestamp} data-tooltip={formatFullDateTime(timestamp)}>
			{formatTimestamp(timestamp)}
		</time>
	);
}

function SessionLink({
	sessionId,
	project,
	label,
	onSessionLink,
}: {
	sessionId: string;
	project: string;
	label: string;
	onSessionLink?: ((id: string) => void) | undefined;
}) {
	return (
		<a
			className={SESSION_LINK_CLASSES}
			href={`#/${project}/${sessionId}`}
			onClick={
				onSessionLink
					? (e: React.MouseEvent) => {
							e.preventDefault();
							onSessionLink(sessionId);
						}
					: undefined
			}
		>
			{label}
		</a>
	);
}

export function UserMessage({
	turn,
	isSubAgent,
	planSessionId,
	implSessionId,
	project,
	onSessionLink,
	onLinkClick,
}: UserMessageProps) {
	if (turn.bashInput !== undefined || turn.bashStdout !== undefined) {
		return (
			<TurnBox role="user" timestamp={turn.timestamp ? <TimestampLabel timestamp={turn.timestamp} /> : null}>
				<UserBashContent turn={turn} />
			</TurnBox>
		);
	}

	if (turn.ideOpenedFile !== undefined) {
		return (
			<div className={IDE_OPENED_FILE_NOTICE_CLASSES}>
				<Text>{T_OPENED}</Text><Text>{T_SP_1}</Text><code className={IDE_OPENED_FILE_PATH_CLASSES}>{turn.ideOpenedFile}</code>
			</div>
		);
	}

	if (STATUS_RE.test(turn.text.trim())) {
		return <div className={STATUS_NOTICE_CLASSES}>{turn.text}</div>;
	}

	const isPlanMessage = turn.text.startsWith(PLAN_PREFIX);
	const showPlanLink = planSessionId && project && isPlanMessage;
	const showImplLink = implSessionId && project && !isPlanMessage;
	const role = isSubAgent ? "agent" : "user";

	return (
		<TurnBox
			role={role}
			timestamp={
				<>
					{showPlanLink ? (
						<SessionLink
							sessionId={planSessionId}
							project={project}
							label="View planning session"
							onSessionLink={onSessionLink}
						/>
					) : null}
					{showImplLink ? (
						<SessionLink
							sessionId={implSessionId}
							project={project}
							label="View implementation session"
							onSessionLink={onSessionLink}
						/>
					) : null}
					{turn.timestamp ? <TimestampLabel timestamp={turn.timestamp} /> : null}
				</>
			}
		>
			{turn.command ? (
				<div className={COMMAND_CALL_CLASSES}>
					<span className={SKILL_BADGE_CLASSES}><Text>{T_SKILL}</Text></span>
					<span className={COMMAND_CALL_LABEL_CLASSES}>{turn.command.name}</span>
				</div>
			) : null}
			<MarkdownRenderer content={turn.text} onLinkClick={onLinkClick} />
			{turn.attachments && turn.attachments.length > 0 ? (
				<div className={ATTACHMENTS_CLASSES}>
					{turn.attachments.map((a, i) => (
						<span key={i} className={ATTACHMENT_BADGE_CLASSES}>
							<Text>{T_IMAGE}</Text>{a.mediaType.replace(IMAGE_MEDIA_TYPE_PREFIX_REGEX, "")}
						</span>
					))}
				</div>
			) : null}
		</TurnBox>
	);
}
