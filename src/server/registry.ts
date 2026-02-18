import { existsSync } from "node:fs";
import { join } from "node:path";
import { PluginRegistry } from "./plugin-registry.ts";
import { claudeCodePlugin } from "./plugins/claude-code/index.ts";
import { codexCliPlugin } from "./plugins/codex-cli/index.ts";
import { openCodePlugin } from "./plugins/opencode/index.ts";

export function createRegistry(): PluginRegistry {
  const registry = new PluginRegistry();

  // Auto-discover: register plugins whose data dirs exist
  const claudeDir = claudeCodePlugin.getDefaultDataDir();
  if (claudeDir && existsSync(claudeDir)) {
    registry.register(claudeCodePlugin);
  }

  const codexDir = codexCliPlugin.getDefaultDataDir();
  if (codexDir && existsSync(codexDir)) {
    registry.register(codexCliPlugin);
  }

  // OpenCode: check for the actual DB file, not just the directory
  const openCodeDir = openCodePlugin.getDefaultDataDir();
  if (openCodeDir && existsSync(join(openCodeDir, "opencode.db"))) {
    registry.register(openCodePlugin);
  }

  return registry;
}
