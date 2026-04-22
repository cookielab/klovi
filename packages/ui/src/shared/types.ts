import type { DashboardStats } from "@cookielab.io/klovi-plugin-core";

export type {
	AssistantTurn,
	Attachment,
	ContentBlock,
	DashboardStats,
	GlobalSessionResult,
	ModelTokenUsage,
	ParseErrorTurn,
	Project,
	Session,
	SessionSummary,
	SystemTurn,
	ThinkingBlock,
	TokenUsage,
	ToolCallWithResult,
	ToolResultImage,
	Turn,
	UserTurn,
} from "@cookielab.io/klovi-plugin-core";

export type StatsResponse = {
	stats: DashboardStats;
	cachedAt?: string | undefined;
	refreshing: boolean;
};
