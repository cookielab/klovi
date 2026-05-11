import { Text } from "@cookielab.io/klovi-design-system";
import { useCallback, useState } from "react";
import { useKloviHostBridge, useRunKloviEffect } from "../../lib/context";
import { kloviHostBridge } from "../../lib/rpc-client";
import type { UpdateStatus } from "../../shared/rpc-types";

const T_TIMES = "&times;";

const NOTIFICATION_CLASSES =
	"flex items-center gap-[12px] border-border-muted border-b bg-accent-subtle px-[12px] py-[6px] text-[0.85rem]";
const TEXT_CLASSES = "flex-1 text-foreground";
const ACTION_CLASSES =
	"cursor-pointer border-0 bg-accent px-[12px] py-[4px] text-[0.8rem] text-white enabled:hover:opacity-90 disabled:cursor-default disabled:opacity-60";
const DISMISS_CLASSES =
	"cursor-pointer border-0 bg-transparent px-[4px] py-0 text-[1.1rem] leading-none text-foreground-subtle hover:text-foreground";

type UpdateNotificationProps = {
	status: UpdateStatus;
	dismissed: boolean;
	onDismiss: () => void;
	manualCheckResult: UpdateStatus | null;
	onDismissManualCheck: () => void;
};

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

function UpdateNotification({
	status,
	dismissed,
	onDismiss,
	manualCheckResult,
	onDismissManualCheck,
}: UpdateNotificationProps): React.ReactNode {
	const hostBridge = useKloviHostBridge();
	if (!hostBridge.getCapabilities().updater) {
		return null;
	}

	// Manual check result takes priority (temporary banner)
	if (manualCheckResult && manualCheckResult.status !== "ready") {
		return (
			<div className={NOTIFICATION_CLASSES}>
				<span className={TEXT_CLASSES}>{formatManualCheckResult(manualCheckResult)}</span>
				<button type="button" className={DISMISS_CLASSES} aria-label="Dismiss" onClick={onDismissManualCheck}>
					<Text>{T_TIMES}</Text>
				</button>
			</div>
		);
	}

	if (dismissed || status.status !== "ready" || !status.latestVersion) {
		return null;
	}

	return <ReadyBanner latestVersion={status.latestVersion} onDismiss={onDismiss} />;
}

function ReadyBanner({ latestVersion, onDismiss }: { latestVersion: string; onDismiss: () => void }): React.ReactNode {
	const runKloviEffect = useRunKloviEffect();
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleApply = useCallback(async () => {
		setApplying(true);
		setError(null);
		try {
			const result = await runKloviEffect(kloviHostBridge.applyUpdate());
			if (!result.ok) {
				setError(result.error ?? "Update failed");
				setApplying(false);
			}
		} catch {
			setError("Update failed");
			setApplying(false);
		}
	}, [runKloviEffect]);

	return (
		<div className={NOTIFICATION_CLASSES}>
			<span className={TEXT_CLASSES}>{error ? `Update failed: ${error}` : `Klovi v${latestVersion} is ready`}</span>
			<button type="button" className={ACTION_CLASSES} disabled={applying} onClick={handleApply}>
				{applying ? "Restarting…" : "Restart to update"}
			</button>
			<button type="button" className={DISMISS_CLASSES} aria-label="Dismiss" onClick={onDismiss}>
				<Text>{T_TIMES}</Text>
			</button>
		</div>
	);
}

export { UpdateNotification };
