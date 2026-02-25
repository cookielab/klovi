export interface Project {
  encodedPath: string;
  name: string;
  fullPath: string;
  sessionCount: number;
  lastActivity: string;
}

export interface SessionSummary {
  sessionId: string;
  timestamp: string;
  slug: string;
  firstMessage: string;
  model: string;
  gitBranch: string;
  sessionType?: "plan" | "implementation";
  pluginId?: string;
}

export interface Session {
  sessionId: string;
  project: string;
  turns: Turn[];
  planSessionId?: string;
  implSessionId?: string;
  pluginId?: string;
}

export type Turn = UserTurn | AssistantTurn | SystemTurn | ParseErrorTurn;

export interface Attachment {
  type: "image";
  mediaType: string;
}

export interface UserTurn {
  kind: "user";
  uuid: string;
  timestamp: string;
  text: string;
  command?: {
    name: string;
    args: string;
  };
  attachments?: Attachment[];
  bashInput?: string;
  bashStdout?: string;
  bashStderr?: string;
  ideOpenedFile?: string;
}

export type ContentBlock =
  | { type: "thinking"; block: ThinkingBlock }
  | { type: "text"; text: string }
  | { type: "tool_call"; call: ToolCallWithResult };

export interface AssistantTurn {
  kind: "assistant";
  uuid: string;
  timestamp: string;
  model: string;
  contentBlocks: ContentBlock[];
  usage?: TokenUsage;
  stopReason?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface SystemTurn {
  kind: "system";
  uuid: string;
  timestamp: string;
  text: string;
}

export interface ParseErrorTurn {
  kind: "parse_error";
  uuid: string;
  timestamp: string;
  lineNumber: number;
  rawLine: string;
  errorType: "json_parse" | "invalid_structure";
  errorDetails?: string;
}

export interface ThinkingBlock {
  text: string;
}

export interface ToolCallWithResult {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  result: string;
  isError: boolean;
  resultImages?: ToolResultImage[];
  subAgentId?: string;
}

export interface ToolResultImage {
  mediaType: string;
  data: string;
}

export interface GlobalSessionResult extends SessionSummary {
  encodedPath: string;
  projectName: string;
  pluginId?: string;
}

export interface ModelTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface DashboardStats {
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
}
