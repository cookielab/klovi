import { Text } from "@cookielab.io/klovi-design-system";

const T_LARR_BACK = "&larr; Back";
const T_LARR_BACK_TO_SESSION = "&larr; Back to session";
const T_NBSP = "/&nbsp;";
const T_SP_1 = " ";

const BACK_BTN_CLASSES =
	"back-btn flex cursor-pointer items-center gap-[6px] border-0 bg-transparent px-3 py-2 font-[inherit] text-[0.85rem] text-accent hover:underline";
const BREADCRUMB_CLASSES = "font-normal text-foreground-subtle";
const BADGE_BASE_CLASSES =
	"session-type-badge inline-block px-[6px] py-px align-middle text-[0.65rem] font-semibold leading-[1.4] tracking-[0.02em]";
const BADGE_PLAN_CLASSES = "bg-plan-subtle text-plan";
const BADGE_IMPL_CLASSES = "bg-impl-subtle text-impl";
const COPY_BTN_BASE_CLASSES =
	"btn-copy-command inline-flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground-subtle transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground";
const COPY_BTN_COPIED_CLASSES = "copied text-success!";

export function BackControl({
	onBack,
	backHref,
}: {
	onBack: (() => void) | undefined;
	backHref: string | undefined;
}): React.ReactNode {
	if (onBack) {
		return (
			<button type="button" className={BACK_BTN_CLASSES} onClick={onBack}>
				<Text>{T_LARR_BACK}</Text>
			</button>
		);
	}
	if (backHref) {
		return (
			<a className={BACK_BTN_CLASSES} href={backHref}>
				<Text>{T_LARR_BACK_TO_SESSION}</Text>
			</a>
		);
	}
	return null;
}

export function Breadcrumb({ breadcrumb }: { breadcrumb: string | undefined }): React.ReactNode {
	if (!breadcrumb) {
		return null;
	}
	return (
		<span className={BREADCRUMB_CLASSES}>
			{breadcrumb}
			<Text>{T_SP_1}</Text>
			<Text>{T_NBSP}</Text>
		</span>
	);
}

export function SessionTypeBadge({
	sessionType,
}: {
	sessionType: "plan" | "implementation" | undefined;
}): React.ReactNode {
	if (!sessionType) {
		return null;
	}
	return (
		<span
			className={`${BADGE_BASE_CLASSES} ${sessionType} ${
				sessionType === "plan" ? BADGE_PLAN_CLASSES : BADGE_IMPL_CLASSES
			}`}
		>
			{sessionType === "plan" ? "Plan" : "Impl"}
		</span>
	);
}

export function CopyCommandButton({
	copyCommand,
	copied,
	onCopy,
}: {
	copyCommand: string | undefined;
	copied: boolean;
	onCopy: () => void;
}): React.ReactNode {
	if (!copyCommand) {
		return null;
	}
	return (
		<button
			type="button"
			className={`${COPY_BTN_BASE_CLASSES} ${copied ? COPY_BTN_COPIED_CLASSES : ""}`}
			onClick={onCopy}
			title={copied ? "Copied!" : "Copy resume command"}
		>
			{copied ? (
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" role="img" aria-label="Copied">
					<path
						d="M3 8.5L6.5 12L13 4"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			) : (
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" role="img" aria-label="Copy">
					<rect x="5" y="2" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
					<path d="M3 5v7.5A1.5 1.5 0 004.5 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				</svg>
			)}
		</button>
	);
}
