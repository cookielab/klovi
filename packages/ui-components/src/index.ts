// Re-exports from all domains — populated as domains are built

export {
	AssistantMessage,
	MarkdownRenderer,
	MessageList,
	SubAgentView,
	ThinkingBlock as ThinkingBlockComponent,
	UserBashContent,
	UserMessage,
} from "./messages/index";
export type { KeyboardHandlers, PresentationState } from "./presentation/index";
export { PresentationShell, useKeyboard, usePresentationMode } from "./presentation/index";
export type { SearchModalProps } from "./search/index";
export { SearchModal } from "./search/index";
export type {
	DashboardStatsProps,
	HiddenProjectListProps,
	ProjectListProps,
	SessionListProps,
} from "./sessions/index";
export {
	DashboardStats as DashboardStatsPanel,
	HiddenProjectList,
	ProjectList,
	projectDisplayName,
	SessionList,
} from "./sessions/index";
export {
	BashToolContent,
	DiffView,
	formatDiff,
	formatToolInput,
	getToolSummary,
	hasInputFormatter,
	MAX_OUTPUT_LENGTH,
	MAX_THINKING_PREVIEW,
	SmartToolOutput,
	ToolCall,
	truncateOutput,
} from "./tools/index";
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
} from "./types/index";
export { groupContentBlocks } from "./types/index";
export {
	detectOutputFormat,
	ErrorBoundary,
	FetchError,
	formatFullDateTime,
	formatRelativeTime,
	formatTime,
	formatTimestamp,
	ImageLightbox,
	isClaudeModel,
	shortModel,
} from "./utilities/index";
