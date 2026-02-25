import { useState } from "react";
import faviconUrl from "../../../../favicon.svg";
import "./Onboarding.css";

interface SecurityNoticeContentProps {
  headingId: string;
  onAccept: () => void;
  onDontShowAgain?: () => void;
}

export function SecurityNoticeContent({
  headingId,
  onAccept,
  onDontShowAgain,
}: SecurityNoticeContentProps) {
  const [dontShow, setDontShow] = useState(false);

  const handleAccept = () => {
    if (dontShow && onDontShowAgain) {
      onDontShowAgain();
    }
    onAccept();
  };

  return (
    <>
      <img src={faviconUrl} alt="" width="64" height="64" className="onboarding-logo" />
      <h1 id={headingId} className="onboarding-heading">
        Session Data Notice
      </h1>
      <p>
        Klovi reads AI coding session history from your local machine. Session data may contain
        sensitive information such as API keys, credentials, or private code snippets.
      </p>
      <p>
        Klovi is fully local — your data never leaves your machine. Klovi is open source, so you can
        verify this yourself.
      </p>
      <p className="onboarding-muted">
        Be mindful when screen sharing or using Klovi in public settings.
      </p>
      <label className="onboarding-muted" style={{ display: "block", marginTop: "16px" }}>
        <input
          type="checkbox"
          className="custom-checkbox"
          checked={dontShow}
          onChange={(e) => setDontShow(e.target.checked)}
        />
        {" Don't show this again"}
      </label>
      <button type="button" className="onboarding-button" onClick={handleAccept}>
        Accept & Continue
      </button>
    </>
  );
}

interface SecurityWarningProps {
  onAccept: () => void;
  onDontShowAgain: () => void;
}

export function SecurityWarning({ onAccept, onDontShowAgain }: SecurityWarningProps) {
  return (
    <section className="onboarding" aria-labelledby="security-warning-heading">
      <div className="onboarding-content">
        <SecurityNoticeContent
          headingId="security-warning-heading"
          onAccept={onAccept}
          onDontShowAgain={onDontShowAgain}
        />
      </div>
    </section>
  );
}
