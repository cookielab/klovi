import { Text } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { useCallback, useState } from "react";
import faviconUrl from "../../../../favicon.svg";


const T_SESSION_DATA_NOTICE = "Session Data Notice";
const T_KLOVI_READS_AI_CODING_SESSION_ = "Klovi reads AI coding session history from your local machine. Session data may contain sensitive information\n\t\t\t\tsuch as API keys, credentials, or private code snippets.";
const T_KLOVI_IS_FULLY_LOCAL_YOUR_DATA = "Klovi is fully local — your data never leaves your machine. Klovi is open source, so you can verify this\n\t\t\t\tyourself.";
const T_BE_MINDFUL_WHEN_SCREEN_SHARING = "Be mindful when screen sharing or using Klovi in public settings.";
const T_DON_T_SHOW_THIS_AGAIN = " Don't show this again";
const T_ACCEPT_CONTINUE = "Accept & Continue";

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

function SecurityNoticeContent({ headingId, onAccept, onDontShowAgain }: SecurityNoticeContentProps): React.ReactNode {
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
				<Text>{T_SESSION_DATA_NOTICE}</Text>
			</h1>
			<p>
				<Text>{T_KLOVI_READS_AI_CODING_SESSION_}</Text>
			</p>
			<p>
				<Text>{T_KLOVI_IS_FULLY_LOCAL_YOUR_DATA}</Text>
			</p>
			<p className={MUTED_CLASSES}><Text>{T_BE_MINDFUL_WHEN_SCREEN_SHARING}</Text></p>
			<label className={CHECKBOX_LABEL_CLASSES}>
				<input type="checkbox" className="custom-checkbox" checked={dontShow} onChange={handleDontShowChange} />
				<Text>{T_DON_T_SHOW_THIS_AGAIN}</Text>
			</label>
			<button type="button" className={BUTTON_CLASSES} onClick={handleAccept}>
				<Text>{T_ACCEPT_CONTINUE}</Text>
			</button>
		</>
	);
}

type SecurityWarningProps = {
	onAccept: () => void;
	onDontShowAgain: () => void;
};

function SecurityWarning({ onAccept, onDontShowAgain }: SecurityWarningProps): React.ReactNode {
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
