import { useCallback, useEffect, useState } from "react";
import { BackControl, Breadcrumb, CopyCommandButton, SessionTypeBadge } from "./Header.parts";

const N_1500 = 1500;

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
				<BackControl onBack={onBack} backHref={backHref} />
				<Breadcrumb breadcrumb={breadcrumb} />
				{title}
				<SessionTypeBadge sessionType={sessionType} />
				<CopyCommandButton copyCommand={copyCommand} copied={copied} onCopy={handleCopy} />
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
