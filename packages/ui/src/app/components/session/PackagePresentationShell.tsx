import { PresentationShell as UiPresentationShell } from "@cookielab.io/klovi-ui-components/presentation";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import type { Turn } from "../../../shared/types";
import { getFrontendPlugin } from "../../plugin-registry";

type PackagePresentationShellProps = {
	turns: Turn[];
	onExit: () => void;
	sessionId: string;
	project: string;
	pluginId?: string | undefined;
	isSubAgent?: boolean | undefined;
};

export function PackagePresentationShell({
	turns,
	onExit,
	sessionId,
	project,
	pluginId,
	isSubAgent,
}: PackagePresentationShellProps) {
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
			pluginId={pluginId}
			isSubAgent={isSubAgent}
			onLinkClick={handleLinkClick}
			getFrontendPlugin={getFrontendPlugin}
		/>
	);
}
