import { claudeCodeFrontendPlugin } from "@cookielab.io/klovi-plugin-claude-code/frontend";
import { codexFrontendPlugin } from "@cookielab.io/klovi-plugin-codex/frontend";
import type {
  FrontendPlugin,
  FrontendInputFormatter as InputFormatter,
  FrontendSummaryExtractor as SummaryExtractor,
} from "@cookielab.io/klovi-plugin-core";
import { openCodeFrontendPlugin } from "@cookielab.io/klovi-plugin-opencode/frontend";

export type { InputFormatter, SummaryExtractor };
export type { FrontendPlugin };

const pluginRegistry = new Map<string, FrontendPlugin>();

export function registerFrontendPlugin(plugin: FrontendPlugin): void {
  pluginRegistry.set(plugin.id, plugin);
}

export function getFrontendPlugin(id: string): FrontendPlugin | undefined {
  return pluginRegistry.get(id);
}

for (const plugin of [claudeCodeFrontendPlugin, codexFrontendPlugin, openCodeFrontendPlugin]) {
  registerFrontendPlugin(plugin);
}
