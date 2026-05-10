import { PresentationShell as UiPresentationShell } from "@cookielab.io/klovi-ui-components/presentation";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import type { Turn } from "../../../shared/types";

type PackagePresentationShellProps = {
	turns: Turn[];
	onExit: () => void;
	sessionId: string;
	project: string;
	isSubAgent?: boolean | undefined;
};

export function PackagePresentationShell({
	turns,
	onExit,
	sessionId,
	project,
	isSubAgent,
}: PackagePresentationShellProps): React.ReactNode {
	const runKloviEffect = useRunKloviEffect();
	const handleLinkClick = useCallback(
		(url: string) => {
			runKloviEffect(kloviHostBridge.openExternal({ url: url })).catch(() => undefined);
		},
		[runKloviEffect],
	);
	return (
		<UiPresentationShell
			turns={turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			isSubAgent={isSubAgent}
			onLinkClick={handleLinkClick}
		/>
	);
}
