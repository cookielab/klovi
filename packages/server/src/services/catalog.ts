import { claudeCodePlugin, DEFAULT_CLAUDE_CODE_DIR } from "@cookielab.io/klovi-plugin-claude-code";
import { codexCliPlugin, DEFAULT_CODEX_CLI_DIR } from "@cookielab.io/klovi-plugin-codex";
import { cursorPlugin, DEFAULT_CURSOR_DIR } from "@cookielab.io/klovi-plugin-cursor";
import { DEFAULT_OPENCODE_DIR, openCodePlugin } from "@cookielab.io/klovi-plugin-opencode";
import type { ToolPlugin } from "./plugin-types";

export type BuiltinPluginDescriptor = {
	plugin: ToolPlugin;
	defaultDir: string;
	defaultEnabled: boolean;
	status?: "beta" | undefined;
};

export const BUILTIN_PLUGIN_DESCRIPTORS: BuiltinPluginDescriptor[] = [
	{
		plugin: claudeCodePlugin,
		defaultDir: DEFAULT_CLAUDE_CODE_DIR,
		defaultEnabled: true,
	},
	{
		plugin: codexCliPlugin,
		defaultDir: DEFAULT_CODEX_CLI_DIR,
		defaultEnabled: true,
	},
	{
		plugin: openCodePlugin,
		defaultDir: DEFAULT_OPENCODE_DIR,
		defaultEnabled: true,
	},
	{
		plugin: cursorPlugin,
		defaultDir: DEFAULT_CURSOR_DIR,
		defaultEnabled: false,
		status: "beta",
	},
];

export const BUILTIN_PLUGIN_ID_SET = new Set(BUILTIN_PLUGIN_DESCRIPTORS.map((descriptor) => descriptor.plugin.id));
