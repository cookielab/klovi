import type { UpdateStatus } from "../../shared/rpc-types.ts";
import { getRPC } from "../rpc.ts";
import "./UpdateNotification.css";

interface UpdateNotificationProps {
  status: UpdateStatus;
  dismissed: boolean;
  onDismiss: () => void;
}

export function UpdateNotification({ status, dismissed, onDismiss }: UpdateNotificationProps) {
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
