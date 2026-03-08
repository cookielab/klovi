import { useState } from "react";
import { useKloviHostBridge } from "../../lib/context.ts";
import type { UpdateStatus } from "../../shared/rpc-types.ts";
import "./UpdateNotification.css";

interface UpdateNotificationProps {
  status: UpdateStatus;
  dismissed: boolean;
  onDismiss: () => void;
  manualCheckResult: UpdateStatus | null;
  onDismissManualCheck: () => void;
}

function formatManualCheckResult(status: UpdateStatus): string {
  if (status.status === "up-to-date") {
    return "You're up to date";
  }
  if (status.status === "error") {
    return `Update check failed: ${status.error ?? "Unknown error"}`;
  }
  if (status.status === "available") {
    return `v${status.latestVersion} is available`;
  }
  if (status.status === "downloading") {
    return `Downloading v${status.latestVersion}...`;
  }
  if (status.status === "ready") {
    return `v${status.latestVersion} is ready to install`;
  }
  return "Check complete";
}

export function UpdateNotification({
  status,
  dismissed,
  onDismiss,
  manualCheckResult,
  onDismissManualCheck,
}: UpdateNotificationProps) {
  const hostBridge = useKloviHostBridge();
  if (!hostBridge.getCapabilities().updater) return null;

  // Manual check result takes priority (temporary banner)
  if (manualCheckResult && manualCheckResult.status !== "ready") {
    return (
      <div className="update-notification">
        <span className="update-notification-text">
          {formatManualCheckResult(manualCheckResult)}
        </span>
        <button
          type="button"
          className="update-notification-dismiss"
          aria-label="Dismiss"
          onClick={onDismissManualCheck}
        >
          &times;
        </button>
      </div>
    );
  }

  if (dismissed || status.status !== "ready" || !status.latestVersion) {
    return null;
  }

  return <ReadyBanner latestVersion={status.latestVersion} onDismiss={onDismiss} />;
}

function ReadyBanner({
  latestVersion,
  onDismiss,
}: {
  latestVersion: string;
  onDismiss: () => void;
}) {
  const hostBridge = useKloviHostBridge();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const result = await hostBridge.applyUpdate();
      if (!result.ok) {
        setError(result.error ?? "Update failed");
        setApplying(false);
      }
    } catch {
      setError("Update failed");
      setApplying(false);
    }
  };

  return (
    <div className="update-notification">
      <span className="update-notification-text">
        {error ? `Update failed: ${error}` : `Klovi v${latestVersion} is ready`}
      </span>
      <button
        type="button"
        className="update-notification-action"
        disabled={applying}
        onClick={handleApply}
      >
        {applying ? "Restarting…" : "Restart to update"}
      </button>
      <button
        type="button"
        className="update-notification-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        &times;
      </button>
    </div>
  );
}
