import type React from "react";
import { useCallback, useState } from "react";
import faviconUrl from "../../../../favicon.svg";
import "./SecurityWarning.css";

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
			<img src={faviconUrl} alt="" width="64" height="64" className="security-warning-logo" />
			<h1 id={headingId} className="security-warning-heading">
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
			<p className="security-warning-muted">Be mindful when screen sharing or using Klovi in public settings.</p>
			<label className="security-warning-muted" style={{ display: "block", marginTop: "16px" }}>
				<input type="checkbox" className="custom-checkbox" checked={dontShow} onChange={handleDontShowChange} />
				{" Don't show this again"}
			</label>
			<button type="button" className="security-warning-button" onClick={handleAccept}>
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
		<section className="security-warning" aria-labelledby="security-warning-heading">
			<div className="security-warning-content">
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
