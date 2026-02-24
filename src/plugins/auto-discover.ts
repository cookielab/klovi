import { existsSync } from "node:fs";
import { join } from "node:path";
import { claudeCodePlugin } from "./claude-code/index.ts";
import { codexCliPlugin } from "./codex-cli/index.ts";
import { openCodePlugin } from "./opencode/index.ts";
import { PluginRegistry } from "./registry.ts";

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
