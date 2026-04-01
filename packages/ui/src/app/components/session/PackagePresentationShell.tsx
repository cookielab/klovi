import { PresentationShell as UiPresentationShell } from "@cookielab.io/klovi-ui-components/presentation";
import { useCallback } from "react";
import { useKloviHostBridge } from "../../../lib/context.ts";
import type { Turn } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

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
	const hostBridge = useKloviHostBridge();
	const handleLinkClick = useCallback(
		(url: string) => {
			hostBridge.openExternal({ url: url }).catch(() => {});
		},
		[hostBridge],
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
