import type React from "react";
import type { BadgeVariant } from "../../types.ts";

type BadgeProps = {
	variant?: BadgeVariant;
	mono?: boolean;
	children: React.ReactNode;
};

const BASE_CLASSES =
	"inline-block align-middle px-1.5 py-px text-[0.65rem] font-semibold leading-[1.4] tracking-[0.02em]";

const MONO_CLASSES = "font-mono uppercase tracking-[0.06em] text-[0.68rem] px-2 py-[2px]";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
	user: "text-role-user bg-role-user-surface",
	assistant: "text-role-assistant bg-role-assistant-surface",
	agent: "text-role-agent bg-role-agent-surface",
	"sub-agent": "text-role-subagent bg-role-subagent/10",
	tool: "text-foreground-subtle bg-surface-sunken uppercase tracking-[0.03em] text-[0.7rem]",
	system: "text-foreground-subtle bg-foreground-subtle/10",
	error: "text-error bg-error/10",
	plan: "text-plan bg-plan-subtle",
	implementation: "text-impl bg-impl-subtle",
	default: "text-foreground-subtle bg-surface-sunken",
};

export function Badge({ variant = "default", mono, children }: BadgeProps) {
	const classes = [BASE_CLASSES, VARIANT_STYLES[variant], mono ? MONO_CLASSES : ""].filter(Boolean).join(" ");

	return <span className={classes}>{children}</span>;
}
