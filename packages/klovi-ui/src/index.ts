// Re-exports from all domains — populated as domains are built

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
} from "./tools/index.ts";
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
} from "./types/index.ts";
export { groupContentBlocks } from "./types/index.ts";
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
} from "./utilities/index.ts";
