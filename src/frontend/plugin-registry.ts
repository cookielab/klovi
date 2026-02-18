import {
  codexInputFormatters,
  codexSummaryExtractors,
} from "../server/plugins/codex-cli/extractors.ts";
import {
  openCodeInputFormatters,
  openCodeSummaryExtractors,
} from "../server/plugins/opencode/extractors.ts";

export type SummaryExtractor = (input: Record<string, unknown>) => string;
export type InputFormatter = (input: Record<string, unknown>) => string;

export interface FrontendPlugin {
  displayName: string;
  summaryExtractors: Record<string, SummaryExtractor>;
  inputFormatters: Record<string, InputFormatter>;
}

const pluginRegistry = new Map<string, FrontendPlugin>();

export function registerFrontendPlugin(id: string, plugin: FrontendPlugin): void {
  pluginRegistry.set(id, plugin);
}

export function getFrontendPlugin(id: string): FrontendPlugin | undefined {
  return pluginRegistry.get(id);
}

// Register Codex CLI frontend plugin
registerFrontendPlugin("codex-cli", {
  displayName: "Codex",
  summaryExtractors: codexSummaryExtractors,
  inputFormatters: codexInputFormatters,
});

// Register OpenCode frontend plugin
registerFrontendPlugin("opencode", {
  displayName: "OpenCode",
  summaryExtractors: openCodeSummaryExtractors,
  inputFormatters: openCodeInputFormatters,
});
