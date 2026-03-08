export const BUILTIN_KLOVI_PLUGIN_IDS = ["claude-code", "codex-cli", "opencode"] as const;

export type BuiltinKloviPluginId = (typeof BUILTIN_KLOVI_PLUGIN_IDS)[number];

export const BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES: Record<BuiltinKloviPluginId, string> = {
  "claude-code": "Claude Code",
  "codex-cli": "Codex",
  opencode: "OpenCode",
};

export const KLOVI_PLUGIN_PACKAGE_NAMES = {
  core: "@cookielab.io/klovi-plugin-core",
  claudeCode: "@cookielab.io/klovi-plugin-claude-code",
  codex: "@cookielab.io/klovi-plugin-codex",
  opencode: "@cookielab.io/klovi-plugin-opencode",
} as const;

export type KloviPluginPackageName =
  (typeof KLOVI_PLUGIN_PACKAGE_NAMES)[keyof typeof KLOVI_PLUGIN_PACKAGE_NAMES];

export function isBuiltinKloviPluginId(value: string): value is BuiltinKloviPluginId {
  return (BUILTIN_KLOVI_PLUGIN_IDS as readonly string[]).includes(value);
}
