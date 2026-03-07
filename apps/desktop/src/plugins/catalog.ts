import {
  claudeCodePlugin,
  DEFAULT_CLAUDE_CODE_DIR,
  setClaudeCodeDir,
} from "@cookielab.io/klovi-plugin-claude-code";
import {
  codexCliPlugin,
  DEFAULT_CODEX_CLI_DIR,
  setCodexCliDir,
} from "@cookielab.io/klovi-plugin-codex";
import {
  DEFAULT_OPENCODE_DIR,
  openCodePlugin,
  setOpenCodeDir,
} from "@cookielab.io/klovi-plugin-opencode";
import type { ToolPlugin } from "../shared/plugin-types.ts";

export interface BuiltinPluginDescriptor {
  plugin: ToolPlugin;
  defaultDir: string;
  setDir: (dir: string) => void;
}

export const BUILTIN_PLUGIN_DESCRIPTORS: BuiltinPluginDescriptor[] = [
  {
    plugin: claudeCodePlugin,
    defaultDir: DEFAULT_CLAUDE_CODE_DIR,
    setDir: setClaudeCodeDir,
  },
  {
    plugin: codexCliPlugin,
    defaultDir: DEFAULT_CODEX_CLI_DIR,
    setDir: setCodexCliDir,
  },
  {
    plugin: openCodePlugin,
    defaultDir: DEFAULT_OPENCODE_DIR,
    setDir: setOpenCodeDir,
  },
];

export const BUILTIN_PLUGIN_ID_SET = new Set(
  BUILTIN_PLUGIN_DESCRIPTORS.map((descriptor) => descriptor.plugin.id),
);
