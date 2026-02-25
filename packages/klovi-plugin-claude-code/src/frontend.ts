import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";

export const claudeCodeFrontendPlugin: FrontendPlugin = {
  id: "claude-code",
  displayName: "Claude Code",
  summaryExtractors: {},
  inputFormatters: {},
  getResumeCommand: (sessionId: string) => `claude --resume ${sessionId}`,
};
