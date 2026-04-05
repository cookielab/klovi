import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { Turn } from "../types/index.ts";
import { FetchError } from "../utilities/index.ts";
import { MessageList } from "./MessageList.tsx";

type SubAgentViewProps = {
	turns: Turn[];
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
	onLinkClick?: ((url: string) => void) | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
};

const LOADING_CLASSES = "flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle";
const EMPTY_CLASSES = "py-2 text-[0.82rem] text-foreground-subtle italic";

export function SubAgentView({
	turns,
	sessionId,
	project,
	pluginId,
	loading,
	error,
	onRetry,
	onLinkClick,
	getFrontendPlugin,
}: SubAgentViewProps) {
	if (loading) {
		return <div className={LOADING_CLASSES}>Loading sub-agent conversation...</div>;
	}
	if (error) {
		return <FetchError error={error} {...(onRetry ? { onRetry: onRetry } : {})} showPrefix={true} />;
	}
	if (turns.length === 0) {
		return <div className={EMPTY_CLASSES}>No sub-agent conversation data available.</div>;
	}

	return (
		<MessageList
			turns={turns}
			sessionId={sessionId}
			project={project}
			pluginId={pluginId}
			isSubAgent={true}
			onLinkClick={onLinkClick}
			getFrontendPlugin={getFrontendPlugin}
		/>
	);
}
