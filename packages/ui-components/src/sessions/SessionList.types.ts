import type { SessionSummary } from "../types/index";

export type SessionListProps = {
	sessions: SessionSummary[];
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
	selectedId?: string | undefined;
	projectName: string;
	onSelect: (sessionId: string) => void;
	onBack: () => void;
	pluginDisplayName?: ((id: string) => string) | undefined;
};
