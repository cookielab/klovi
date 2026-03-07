import { useCallback, useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  breadcrumb?: string | undefined;
  copyCommand?: string | undefined;
  backHref?: string | undefined;
  sessionType?: "plan" | "implementation" | undefined;
  presentationActive: boolean;
  onTogglePresentation: () => void;
  showPresentationToggle: boolean;
}

export function Header({
  title,
  breadcrumb,
  copyCommand,
  backHref,
  sessionType,
  presentationActive,
  onTogglePresentation,
  showPresentationToggle,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!copyCommand) return;
    navigator.clipboard.writeText(copyCommand).then(() => {
      setCopied(true);
    });
  }, [copyCommand]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="header">
      <div className="header-title">
        {backHref && (
          <a className="back-btn" href={backHref}>
            &larr; Back to session
          </a>
        )}
        {breadcrumb && (
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{breadcrumb} /&nbsp;</span>
        )}
        {title}
        {sessionType && (
          <span className={`session-type-badge ${sessionType}`}>
            {sessionType === "plan" ? "Plan" : "Impl"}
          </span>
        )}
        {copyCommand && (
          <button
            type="button"
            className={`btn-copy-command ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy resume command"}
          >
            {copied ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                role="img"
                aria-label="Copied"
              >
                <path
                  d="M3 8.5L6.5 12L13 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                role="img"
                aria-label="Copy"
              >
                <rect
                  x="5"
                  y="2"
                  width="9"
                  height="11"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M3 5v7.5A1.5 1.5 0 004.5 14H10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
      <div className="header-actions">
        {showPresentationToggle && (
          <button
            type="button"
            className={`btn btn-sm ${presentationActive ? "btn-primary" : ""}`}
            onClick={onTogglePresentation}
          >
            {presentationActive ? "Exit Presentation" : "Present"}
          </button>
        )}
      </div>
    </div>
  );
}
