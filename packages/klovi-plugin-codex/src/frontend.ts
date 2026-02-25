import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { codexInputFormatters, codexSummaryExtractors } from "./extractors.ts";

export const codexFrontendPlugin: FrontendPlugin = {
  id: "codex-cli",
  displayName: "Codex",
  summaryExtractors: codexSummaryExtractors,
  inputFormatters: codexInputFormatters,
  getResumeCommand: (sessionId: string) => `codex resume ${sessionId}`,
};
