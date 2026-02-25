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
  sessionType?: "plan" | "implementation" | undefined;
  pluginId?: string | undefined;
}

export interface Session {
  sessionId: string;
  project: string;
  turns: Turn[];
  planSessionId?: string | undefined;
  implSessionId?: string | undefined;
  pluginId?: string | undefined;
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
  usage?: TokenUsage | undefined;
  stopReason?: string | undefined;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number | undefined;
  cacheCreationTokens?: number | undefined;
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
  errorDetails?: string | undefined;
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
  resultImages?: ToolResultImage[] | undefined;
  subAgentId?: string | undefined;
}

export interface ToolResultImage {
  mediaType: string;
  data: string;
}

export interface GlobalSessionResult extends SessionSummary {
  encodedPath: string;
  projectName: string;
  pluginId?: string | undefined;
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

/**
 * Groups content blocks into presentation steps.
 * Each text block is its own step. Consecutive non-text blocks
 * (thinking, tool_call) are grouped into a single step.
 */
export function groupContentBlocks(blocks: ContentBlock[]): ContentBlock[][] {
  const groups: ContentBlock[][] = [];
  let nonTextGroup: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (nonTextGroup.length > 0) {
        groups.push(nonTextGroup);
        nonTextGroup = [];
      }
      groups.push([block]);
    } else {
      nonTextGroup.push(block);
    }
  }
  if (nonTextGroup.length > 0) {
    groups.push(nonTextGroup);
  }
  return groups;
}
