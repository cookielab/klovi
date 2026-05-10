import type React from "react";
import type { TurnRole } from "../../types";

type TurnBoxProps = {
	role: TurnRole;
	badge?: string;
	model?: string;
	timestamp?: React.ReactNode;
	children: React.ReactNode;
};

const TURN_BADGE_BASE = "inline-block px-2 py-[2px] font-mono text-[0.68rem] font-semibold uppercase tracking-[0.06em]";

const TURN_BADGE_MODEL =
	"text-foreground-subtle border border-border text-[0.65rem] normal-case tracking-normal! font-normal";

const BADGE_STYLES: Record<TurnRole, string> = {
	user: "text-role-user bg-role-user-surface",
	assistant: "text-role-assistant bg-role-assistant-surface",
	agent: "text-role-agent bg-role-agent-surface",
	"sub-agent": "text-role-subagent bg-role-subagent/10",
	system: "text-foreground-subtle bg-foreground-subtle/10",
	error: "text-error bg-error/10",
};

const MESSAGE_BASE = "px-[18px] py-4 bg-surface-card border border-border border-l-[3px]";

const MESSAGE_STYLES: Record<TurnRole, string> = {
	user: "border-l-role-user",
	assistant: "border-l-role-assistant",
	agent: "border-l-role-agent",
	"sub-agent": "border-l-role-subagent",
	system: "border-l-border text-[0.85rem] text-foreground-muted",
	error: "border-l-error",
};

const DEFAULT_LABELS: Record<TurnRole, string> = {
	user: "User",
	assistant: "Assistant",
	agent: "Root Agent",
	"sub-agent": "Sub-Agent",
	system: "System",
	error: "Error",
};

export function TurnBox({ role, badge, model, timestamp, children }: TurnBoxProps) {
	const label = badge ?? DEFAULT_LABELS[role];

	return (
		<div className="mb-5">
			<div className="mb-1.5 flex items-center gap-2">
				<span className={`${TURN_BADGE_BASE} ${BADGE_STYLES[role]}`}>{label}</span>
				{model ? <span className={`${TURN_BADGE_BASE} ${TURN_BADGE_MODEL}`}>{model}</span> : null}
				{timestamp ? <span className="ml-auto text-[0.72rem] text-foreground-subtle">{timestamp}</span> : null}
			</div>
			<div className={`${MESSAGE_BASE} ${MESSAGE_STYLES[role]}`}>{children}</div>
		</div>
	);
}
