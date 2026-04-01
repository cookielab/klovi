import { PresentationShell as UiPresentationShell } from "@cookielab.io/klovi-ui-components/presentation";
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
	return (
		<UiPresentationShell
			turns={turns}
			onExit={onExit}
			sessionId={sessionId}
			project={project}
			pluginId={pluginId}
			isSubAgent={isSubAgent}
			onLinkClick={(url: string) => void hostBridge.openExternal({ url: url })}
			getFrontendPlugin={getFrontendPlugin}
		/>
	);
}
