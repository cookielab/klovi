export interface RawLine {
  type: string;
  parentUuid?: string | null;
  uuid?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  cwd?: string;
  sessionId?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  timestamp?: string;
  message?: RawMessage;
  parentToolUseID?: string;
  data?: { type?: string; agentId?: string; [key: string]: unknown };
}

export interface RawMessage {
  role: "user" | "assistant";
  model?: string;
  content: string | RawContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export type RawContentBlock =
  | RawTextBlock
  | RawThinkingBlock
  | RawToolUseBlock
  | RawToolResultBlock
  | RawImageBlock;

export interface RawTextBlock {
  type: "text";
  text: string;
}

export interface RawThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface RawToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RawToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | RawToolResultContent[];
  is_error?: boolean;
}

export interface RawImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type RawToolResultContent = RawToolResultTextContent | RawToolResultImageContent;

export interface RawToolResultTextContent {
  type: "text";
  text: string;
}

export interface RawToolResultImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}
