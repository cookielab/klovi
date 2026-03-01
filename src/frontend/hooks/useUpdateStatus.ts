import { useEffect, useState } from "react";
import type { UpdateStatus } from "../../shared/rpc-types.ts";

const DEFAULT_STATUS: UpdateStatus = {
  status: "up-to-date",
  currentVersion: "",
};

export function useUpdateStatus() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(DEFAULT_STATUS);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    const handleUpdateStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail as UpdateStatus;
      if (detail) {
        setUpdateStatus(detail);
        setUpdateDismissed(false);
      }
    };
    window.addEventListener("klovi:updateStatus", handleUpdateStatus);
    return () => window.removeEventListener("klovi:updateStatus", handleUpdateStatus);
  }, []);

  return {
    updateStatus,
    updateDismissed,
    dismissUpdate: () => setUpdateDismissed(true),
  };
}
