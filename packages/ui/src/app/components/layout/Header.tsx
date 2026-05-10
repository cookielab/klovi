import { Text } from "@cookielab.io/klovi-design-system";
import { useCallback, useEffect, useState } from "react";



const N_1500 = 1500;

const T_LARR_BACK = "&larr; Back";
const T_LARR_BACK_TO_SESSION = "&larr; Back to session";
const T_NBSP = "/&nbsp;";
const T_SP_1 = " ";

type HeaderProps = {
	title: string;
	breadcrumb?: string | undefined;
	copyCommand?: string | undefined;
	onBack?: (() => void) | undefined;
	backHref?: string | undefined;
	sessionType?: "plan" | "implementation" | undefined;
	presentationActive: boolean;
	onTogglePresentation: () => void;
	showPresentationToggle: boolean;
};

const HEADER_CLASSES =
	"sticky top-0 z-[5] flex h-header flex-shrink-0 items-center justify-between border-border border-b bg-surface px-5";
const TITLE_CLASSES = "header-title flex items-center gap-2 text-[0.95rem] font-semibold text-foreground";
const ACTIONS_CLASSES = "flex items-center gap-2";
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
const BTN_CLASSES =
	"inline-flex cursor-pointer items-center gap-[6px] border border-border bg-surface px-3 py-[6px] text-[0.85rem] text-foreground transition-colors duration-150 hover:border-foreground-subtle hover:bg-surface-muted";
const BTN_SM_CLASSES = "h-7 px-2 py-1 text-[0.8rem]";
const BTN_PRIMARY_CLASSES =
	"border-accent! bg-accent! text-foreground-inverse! hover:border-accent-hover! hover:bg-accent-hover!";

export function Header({
	title,
	breadcrumb,
	copyCommand,
	onBack,
	backHref,
	sessionType,
	presentationActive,
	onTogglePresentation,
	showPresentationToggle,
}: HeaderProps): React.ReactNode {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		if (!copyCommand) {
			return;
		}
		navigator.clipboard.writeText(copyCommand).then(() => {
			setCopied(true);
		});
	}, [copyCommand]);

	useEffect(() => {
		if (!copied) {
			return;
		}
		const copiedResetDelay = N_1500;
		const timer = setTimeout(() => setCopied(false), copiedResetDelay);
		return () => clearTimeout(timer);
	}, [copied]);

	return (
		<div className={HEADER_CLASSES}>
			<div className={TITLE_CLASSES}>
				{onBack ? (
					<button type="button" className={BACK_BTN_CLASSES} onClick={onBack}>
						<Text>{T_LARR_BACK}</Text>
					</button>
				) : null}
				{!onBack && backHref ? (
					<a className={BACK_BTN_CLASSES} href={backHref}>
						<Text>{T_LARR_BACK_TO_SESSION}</Text>
					</a>
				) : null}
				{breadcrumb ? <span className={BREADCRUMB_CLASSES}>{breadcrumb}<Text>{T_SP_1}</Text><Text>{T_NBSP}</Text></span> : null}
				{title}
				{sessionType ? (
					<span
						className={`${BADGE_BASE_CLASSES} ${sessionType} ${sessionType === "plan" ? BADGE_PLAN_CLASSES : BADGE_IMPL_CLASSES}`}
					>
						{sessionType === "plan" ? "Plan" : "Impl"}
					</span>
				) : null}
				{copyCommand ? (
					<button
						type="button"
						className={`${COPY_BTN_BASE_CLASSES} ${copied ? COPY_BTN_COPIED_CLASSES : ""}`}
						onClick={handleCopy}
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
								<path
									d="M3 5v7.5A1.5 1.5 0 004.5 14H10"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						)}
					</button>
				) : null}
			</div>
			<div className={ACTIONS_CLASSES}>
				{showPresentationToggle ? (
					<button
						type="button"
						className={`${BTN_CLASSES} ${BTN_SM_CLASSES} ${presentationActive ? BTN_PRIMARY_CLASSES : ""}`}
						onClick={onTogglePresentation}
					>
						{presentationActive ? "Exit Presentation" : "Present"}
					</button>
				) : null}
			</div>
		</div>
	);
}
