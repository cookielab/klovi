export type SummaryExtractor = (input: Record<string, unknown>) => string;
export type InputFormatter = (input: Record<string, unknown>) => string;

export interface FrontendPlugin {
  displayName: string;
  summaryExtractors: Record<string, SummaryExtractor>;
  inputFormatters: Record<string, InputFormatter>;
}

// Plugin registrations will be added as new tool plugins are implemented.
// For now, Claude Code tools use the existing extractors in ToolCall.tsx.
const pluginRegistry = new Map<string, FrontendPlugin>();

export function registerFrontendPlugin(id: string, plugin: FrontendPlugin): void {
  pluginRegistry.set(id, plugin);
}

export function getFrontendPlugin(id: string): FrontendPlugin | undefined {
  return pluginRegistry.get(id);
}
