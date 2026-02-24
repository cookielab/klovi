import { useState } from "react";
import faviconUrl from "../../../../favicon.svg";

interface SecurityWarningProps {
  onAccept: (skipNextTime: boolean) => void;
}

export function SecurityWarning({ onAccept }: SecurityWarningProps) {
  const [skipNextTime, setSkipNextTime] = useState(false);

  return (
    <div className="security-warning" role="alert" aria-labelledby="security-warning-title">
      <div className="security-warning-content">
        <img src={faviconUrl} alt="" width="64" height="64" className="security-warning-logo" />
        <h1 id="security-warning-title" className="security-warning-heading">
          Session Data Notice
        </h1>
        <p>
          Klovi reads AI coding session history from your local machine. Session data may contain
          sensitive information such as API keys, credentials, or private code snippets.
        </p>
        <p>
          Klovi is fully local — your data never leaves your machine. Klovi is open source, so you
          can verify this yourself.
        </p>
        <p className="security-warning-muted">
          Be mindful when screen sharing or using Klovi in public settings.
        </p>
        <label className="security-warning-remember">
          <input
            type="checkbox"
            checked={skipNextTime}
            onChange={(e) => setSkipNextTime(e.target.checked)}
          />
          Don't show this warning again
        </label>
        <button
          type="button"
          className="security-warning-button"
          onClick={() => onAccept(skipNextTime)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
