import { claudeCodeFrontendPlugin } from "@cookielab.io/klovi-plugin-claude-code/frontend";
import { codexFrontendPlugin } from "@cookielab.io/klovi-plugin-codex/frontend";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { cursorFrontendPlugin } from "@cookielab.io/klovi-plugin-cursor/frontend";
import { openCodeFrontendPlugin } from "@cookielab.io/klovi-plugin-opencode/frontend";

const pluginRegistry = new Map<string, FrontendPlugin>();

function registerFrontendPlugin(plugin: FrontendPlugin): void {
	pluginRegistry.set(plugin.id, plugin);
}

function getFrontendPlugin(id: string): FrontendPlugin | undefined {
	return pluginRegistry.get(id);
}

for (const plugin of [claudeCodeFrontendPlugin, codexFrontendPlugin, openCodeFrontendPlugin, cursorFrontendPlugin]) {
	registerFrontendPlugin(plugin);
}

export { getFrontendPlugin, registerFrontendPlugin };
