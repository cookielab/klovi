import faviconUrl from "../../../../favicon.svg";

interface SecurityWarningProps {
  onAccept: () => void;
}

export function SecurityWarning({ onAccept }: SecurityWarningProps) {
  return (
    <div
      className="security-warning"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="security-warning-title"
    >
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
        <button type="button" className="security-warning-button" onClick={onAccept}>
          Continue
        </button>
      </div>
    </div>
  );
}
