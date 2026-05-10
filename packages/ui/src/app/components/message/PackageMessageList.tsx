import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { MessageList as UiMessageList } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import type { Turn } from "../../../shared/types";
import { getFrontendPlugin } from "../../plugin-registry";

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
}: PackageMessageListProps): React.ReactNode {
	const runKloviEffect = useRunKloviEffect();
	const handleLinkClick = useCallback(
		(url: string) => {
			runKloviEffect(kloviHostBridge.openExternal({ url: url })).catch(() => undefined);
		},
		[runKloviEffect],
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
