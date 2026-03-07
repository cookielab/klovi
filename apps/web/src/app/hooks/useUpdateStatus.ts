import { useEffect, useRef, useState } from "react";
import type { UpdateStatus } from "../../shared/rpc-types.ts";

const DEFAULT_STATUS: UpdateStatus = {
  status: "up-to-date",
  currentVersion: "",
};

const MANUAL_CHECK_DISMISS_MS = 5_000;

export function useUpdateStatus() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(DEFAULT_STATUS);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [manualCheckResult, setManualCheckResult] = useState<UpdateStatus | null>(null);
  const manualCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleUpdateStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail as UpdateStatus;
      if (detail) {
        setUpdateStatus(detail);
        setUpdateDismissed(false);
      }
    };
    const handleManualCheck = (e: Event) => {
      const detail = (e as CustomEvent).detail as UpdateStatus;
      if (detail) {
        setManualCheckResult(detail);
        if (manualCheckTimerRef.current) {
          clearTimeout(manualCheckTimerRef.current);
        }
        manualCheckTimerRef.current = setTimeout(() => {
          setManualCheckResult(null);
          manualCheckTimerRef.current = null;
        }, MANUAL_CHECK_DISMISS_MS);
      }
    };
    window.addEventListener("klovi:updateStatus", handleUpdateStatus);
    window.addEventListener("klovi:checkForUpdatesResult", handleManualCheck);
    return () => {
      window.removeEventListener("klovi:updateStatus", handleUpdateStatus);
      window.removeEventListener("klovi:checkForUpdatesResult", handleManualCheck);
      if (manualCheckTimerRef.current) {
        clearTimeout(manualCheckTimerRef.current);
      }
    };
  }, []);

  return {
    updateStatus,
    updateDismissed,
    dismissUpdate: () => setUpdateDismissed(true),
    manualCheckResult,
    dismissManualCheck: () => {
      setManualCheckResult(null);
      if (manualCheckTimerRef.current) {
        clearTimeout(manualCheckTimerRef.current);
        manualCheckTimerRef.current = null;
      }
    },
  };
}
