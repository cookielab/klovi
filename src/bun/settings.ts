import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BUILTIN_KLOVI_PLUGIN_IDS } from "@cookielab.io/klovi-plugin-core";

export type PluginSettings = {
  version: 1;
  plugins: {
    [pluginId: string]: {
      enabled: boolean;
      dataDir: string | null;
    };
  };
  general?:
    | {
        showSecurityWarning?: boolean | undefined;
      }
    | undefined;
};

function createDefaultPluginStates(): PluginSettings["plugins"] {
  return Object.fromEntries(
    BUILTIN_KLOVI_PLUGIN_IDS.map((pluginId) => [pluginId, { enabled: true, dataDir: null }]),
  );
}

export function getDefaultSettings(): PluginSettings {
  return {
    version: 1,
    plugins: createDefaultPluginStates(),
    general: {
      showSecurityWarning: true,
    },
  };
}

export function loadSettings(path: string): PluginSettings {
  try {
    if (!existsSync(path)) return getDefaultSettings();
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || typeof parsed.plugins !== "object") {
      return getDefaultSettings();
    }
    return parsed as PluginSettings;
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(path: string, settings: PluginSettings): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmpPath = join(dir, `.settings-${Date.now()}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(settings, null, 2));
  renameSync(tmpPath, path);
}
