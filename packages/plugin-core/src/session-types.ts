export type Project = {
	encodedPath: string;
	name: string;
	fullPath: string;
	sessionCount: number;
	lastActivity: string;
};

export type SessionSummary = {
	sessionId: string;
	timestamp: string;
	slug: string;
	firstMessage: string;
	model: string;
	gitBranch: string;
	sessionType?: "plan" | "implementation" | undefined;
	pluginId?: string | undefined;
};

export type Session = {
	sessionId: string;
	project: string;
	turns: Turn[];
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
	pluginId?: string | undefined;
};

export type Turn = UserTurn | AssistantTurn | SystemTurn | ParseErrorTurn;

export type Attachment = {
	type: "image";
	mediaType: string;
};

export type UserTurn = {
	kind: "user";
	uuid: string;
	timestamp: string;
	text: string;
	command?:
		| {
				name: string;
				args: string;
		  }
		| undefined;
	attachments?: Attachment[] | undefined;
	bashInput?: string | undefined;
	bashStdout?: string | undefined;
	bashStderr?: string | undefined;
	ideOpenedFile?: string | undefined;
};

export type ContentBlock =
	| { type: "thinking"; block: ThinkingBlock }
	| { type: "text"; text: string }
	| { type: "tool_call"; call: ToolCallWithResult };

export type AssistantTurn = {
	kind: "assistant";
	uuid: string;
	timestamp: string;
	model: string;
	contentBlocks: ContentBlock[];
	usage?: TokenUsage | undefined;
	stopReason?: string | undefined;
};

export type TokenUsage = {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens?: number | undefined;
	cacheCreationTokens?: number | undefined;
};

export type SystemTurn = {
	kind: "system";
	uuid: string;
	timestamp: string;
	text: string;
};

export type ParseErrorTurn = {
	kind: "parse_error";
	uuid: string;
	timestamp: string;
	lineNumber: number;
	rawLine: string;
	errorType: "json_parse" | "invalid_structure";
	errorDetails?: string | undefined;
};

export type ThinkingBlock = {
	text: string;
};

export type ToolCallKind =
	| "shell"
	| "file_read"
	| "file_write"
	| "file_edit"
	| "search"
	| "web"
	| "subagent"
	| "skill"
	| "mcp"
	| "generic";

export type ToolCallWithResult = {
	toolUseId: string;
	kind: ToolCallKind;
	title: string;
	summary?: string | undefined;
	input: Record<string, unknown>;
	formattedInput?: string | undefined;
	result: string;
	isError: boolean;
	resultImages?: ToolResultImage[] | undefined;
	subAgentId?: string | undefined;

	/** Temporary compatibility/debug field. UI must not render from this. */
	name: string;
	rawName?: string | undefined;
};

export type ToolResultImage = {
	mediaType: string;
	data: string;
};

export interface GlobalSessionResult extends SessionSummary {
	encodedPath: string;
	projectName: string;
	pluginId?: string | undefined;
}

export type ModelTokenUsage = {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
};

export type DashboardStats = {
	projects: number;
	sessions: number;
	messages: number;
	todaySessions: number;
	thisWeekSessions: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	toolCalls: number;
	models: Record<string, ModelTokenUsage>;
};
