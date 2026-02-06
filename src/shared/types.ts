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
}

export interface Session {
  sessionId: string;
  project: string;
  turns: Turn[];
}

export type Turn = UserTurn | AssistantTurn | SystemTurn;

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
}

export interface AssistantTurn {
  kind: "assistant";
  uuid: string;
  timestamp: string;
  model: string;
  thinkingBlocks: ThinkingBlock[];
  textBlocks: string[];
  toolCalls: ToolCallWithResult[];
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
}

export interface ToolResultImage {
  mediaType: string;
  data: string;
}
