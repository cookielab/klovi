import { MessageList as UiMessageList } from "@cookielab.io/klovi-ui-components/messages";
import { useCallback } from "react";
import { useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import type { Turn } from "../../../shared/types";

type PackageMessageListProps = {
	turns: Turn[];
	visibleSubSteps?: Map<number, number> | undefined;
	sessionId?: string | undefined;
	project?: string | undefined;
	isSubAgent?: boolean | undefined;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
};

export function PackageMessageList({
	turns,
	visibleSubSteps,
	sessionId,
	project,
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
			isSubAgent={isSubAgent}
			planSessionId={planSessionId}
			implSessionId={implSessionId}
			onLinkClick={handleLinkClick}
		/>
	);
}
