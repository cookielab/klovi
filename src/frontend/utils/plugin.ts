const PLUGIN_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex-cli": "Codex",
  opencode: "OpenCode",
};

export function pluginDisplayName(pluginId: string): string {
  return PLUGIN_NAMES[pluginId] ?? pluginId;
}
