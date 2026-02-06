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
}

export interface RawMessage {
  role: "user" | "assistant";
  model?: string;
  content: string | RawContentBlock[];
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

export interface RawToolResultContent {
  type: "text";
  text: string;
}
