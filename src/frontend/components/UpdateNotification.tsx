import type { UpdateStatus } from "../../shared/rpc-types.ts";
import { getRPC } from "../rpc.ts";
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

  return (
    <div className="update-notification">
      <span className="update-notification-text">Klovi v{status.latestVersion} is ready</span>
      <button
        type="button"
        className="update-notification-action"
        onClick={() => {
          getRPC()
            .request.applyUpdate({} as Record<string, never>)
            .catch(() => {});
        }}
      >
        Restart to update
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
