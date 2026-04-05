import type React from "react";
import { useCallback, useState } from "react";
import faviconUrl from "../../../../favicon.svg";

const WRAPPER_CLASSES = "flex min-h-screen items-center justify-center bg-surface p-[20px]";
const CONTENT_CLASSES = "w-full max-w-[480px] text-center leading-[1.6] text-foreground-muted";
const LOGO_CLASSES = "security-warning-logo mb-[20px] opacity-80";
const HEADING_CLASSES = "mb-[16px] text-[1.3rem] font-semibold text-foreground";
const MUTED_CLASSES = "text-[0.85rem] text-foreground-subtle";
const CHECKBOX_LABEL_CLASSES = "mt-[16px] block text-[0.85rem] text-foreground-subtle";
const BUTTON_CLASSES =
	"mt-[24px] cursor-pointer border-0 bg-accent px-[32px] py-[10px] font-sans text-[0.95rem] font-medium text-foreground-inverse transition-[background] duration-150 hover:bg-accent-hover";

type SecurityNoticeContentProps = {
	headingId: string;
	onAccept: () => void;
	onDontShowAgain?: () => void;
};

function SecurityNoticeContent({ headingId, onAccept, onDontShowAgain }: SecurityNoticeContentProps) {
	const [dontShow, setDontShow] = useState(false);

	const handleAccept = useCallback(() => {
		if (dontShow && onDontShowAgain) {
			onDontShowAgain();
		}
		onAccept();
	}, [dontShow, onDontShowAgain, onAccept]);

	const handleDontShowChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setDontShow(e.target.checked),
		[],
	);

	return (
		<>
			<img src={faviconUrl} alt="" width="64" height="64" className={LOGO_CLASSES} />
			<h1 id={headingId} className={HEADING_CLASSES}>
				Session Data Notice
			</h1>
			<p>
				Klovi reads AI coding session history from your local machine. Session data may contain sensitive information
				such as API keys, credentials, or private code snippets.
			</p>
			<p>
				Klovi is fully local — your data never leaves your machine. Klovi is open source, so you can verify this
				yourself.
			</p>
			<p className={MUTED_CLASSES}>Be mindful when screen sharing or using Klovi in public settings.</p>
			<label className={CHECKBOX_LABEL_CLASSES}>
				<input type="checkbox" className="custom-checkbox" checked={dontShow} onChange={handleDontShowChange} />
				{" Don't show this again"}
			</label>
			<button type="button" className={BUTTON_CLASSES} onClick={handleAccept}>
				Accept & Continue
			</button>
		</>
	);
}

type SecurityWarningProps = {
	onAccept: () => void;
	onDontShowAgain: () => void;
};

function SecurityWarning({ onAccept, onDontShowAgain }: SecurityWarningProps) {
	return (
		<section className={WRAPPER_CLASSES} aria-labelledby="security-warning-heading">
			<div className={CONTENT_CLASSES}>
				<SecurityNoticeContent
					headingId="security-warning-heading"
					onAccept={onAccept}
					onDontShowAgain={onDontShowAgain}
				/>
			</div>
		</section>
	);
}

export { SecurityNoticeContent, SecurityWarning };
