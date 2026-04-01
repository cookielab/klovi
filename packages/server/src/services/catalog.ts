import { claudeCodePlugin, DEFAULT_CLAUDE_CODE_DIR } from "@cookielab.io/klovi-plugin-claude-code";
import { codexCliPlugin, DEFAULT_CODEX_CLI_DIR } from "@cookielab.io/klovi-plugin-codex";
import { DEFAULT_OPENCODE_DIR, openCodePlugin } from "@cookielab.io/klovi-plugin-opencode";
import type { ToolPlugin } from "./plugin-types.ts";

export type BuiltinPluginDescriptor = {
	plugin: ToolPlugin;
	defaultDir: string;
};

export const BUILTIN_PLUGIN_DESCRIPTORS: BuiltinPluginDescriptor[] = [
	{
		plugin: claudeCodePlugin,
		defaultDir: DEFAULT_CLAUDE_CODE_DIR,
	},
	{
		plugin: codexCliPlugin,
		defaultDir: DEFAULT_CODEX_CLI_DIR,
	},
	{
		plugin: openCodePlugin,
		defaultDir: DEFAULT_OPENCODE_DIR,
	},
];

export const BUILTIN_PLUGIN_ID_SET = new Set(BUILTIN_PLUGIN_DESCRIPTORS.map((descriptor) => descriptor.plugin.id));
