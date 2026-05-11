import { useEffect, useRef, useState } from "react";
import { useKloviHostBridge } from "../../lib/context";
import type { UpdateStatus } from "../../shared/rpc-types";

const DEFAULT_STATUS: UpdateStatus = {
	status: "up-to-date",
	currentVersion: "",
};

const MANUAL_CHECK_DISMISS_MS = 5000;

type UseUpdateStatusReturn = {
	updateStatus: UpdateStatus;
	updateDismissed: boolean;
	dismissUpdate: () => void;
	manualCheckResult: UpdateStatus | null;
	dismissManualCheck: () => void;
};

export function useUpdateStatus(): UseUpdateStatusReturn {
	const hostBridge = useKloviHostBridge();
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(DEFAULT_STATUS);
	const [updateDismissed, setUpdateDismissed] = useState(false);
	const [manualCheckResult, setManualCheckResult] = useState<UpdateStatus | null>(null);
	const manualCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const unsubStatus = hostBridge.onUpdateStatus((detail) => {
			setUpdateStatus(detail);
			setUpdateDismissed(false);
		});
		const unsubManual = hostBridge.onManualUpdateResult((detail) => {
			setManualCheckResult(detail);
			if (manualCheckTimerRef.current) {
				clearTimeout(manualCheckTimerRef.current);
			}
			manualCheckTimerRef.current = setTimeout(() => {
				setManualCheckResult(null);
				manualCheckTimerRef.current = null;
			}, MANUAL_CHECK_DISMISS_MS);
		});
		return () => {
			unsubStatus();
			unsubManual();
			if (manualCheckTimerRef.current) {
				clearTimeout(manualCheckTimerRef.current);
			}
		};
	}, [hostBridge]);

	return {
		updateStatus: updateStatus,
		updateDismissed: updateDismissed,
		dismissUpdate: () => setUpdateDismissed(true),
		manualCheckResult: manualCheckResult,
		dismissManualCheck: () => {
			setManualCheckResult(null);
			if (manualCheckTimerRef.current) {
				clearTimeout(manualCheckTimerRef.current);
				manualCheckTimerRef.current = null;
			}
		},
	};
}
