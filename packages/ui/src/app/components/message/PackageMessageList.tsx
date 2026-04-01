import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { MessageList as UiMessageList } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useKloviHostBridge } from "../../../lib/context.ts";
import type { Turn } from "../../../shared/types.ts";
import { getFrontendPlugin } from "../../plugin-registry.ts";

type PackageMessageListProps = {
	turns: Turn[];
	visibleSubSteps?: Map<number, number> | undefined;
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	isSubAgent?: boolean | undefined;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
};

function resolveFrontendPlugin(id: string): FrontendPlugin | undefined {
	return getFrontendPlugin(id);
}

export function PackageMessageList({
	turns,
	visibleSubSteps,
	sessionId,
	project,
	pluginId,
	isSubAgent,
	planSessionId,
	implSessionId,
}: PackageMessageListProps) {
	const hostBridge = useKloviHostBridge();
	const handleLinkClick = useCallback(
		(url: string) => {
			hostBridge.openExternal({ url: url }).catch(() => {});
		},
		[hostBridge],
	);
	return (
		<UiMessageList
			turns={turns}
			visibleSubSteps={visibleSubSteps}
			sessionId={sessionId}
			project={project}
			pluginId={pluginId}
			isSubAgent={isSubAgent}
			planSessionId={planSessionId}
			implSessionId={implSessionId}
			onLinkClick={handleLinkClick}
			getFrontendPlugin={resolveFrontendPlugin}
		/>
	);
}
