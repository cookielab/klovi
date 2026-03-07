import { mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BUILTIN_KLOVI_PLUGIN_IDS } from "@cookielab.io/klovi-plugin-core";
export type UpdateChannel = "stable" | "candidate" | "beta";

export type UpdateSettings = {
  channel: UpdateChannel;
  checkIntervalHours: number;
  autoDownload: boolean;
};

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
  updates?: UpdateSettings | undefined;
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
    updates: {
      channel: "stable",
      checkIntervalHours: 6,
      autoDownload: true,
    },
  };
}

export async function loadSettings(path: string): Promise<PluginSettings> {
  try {
    if (!(await Bun.file(path).exists())) return getDefaultSettings();
    const parsed = await Bun.file(path).json();
    if (parsed.version !== 1 || typeof parsed.plugins !== "object") {
      return getDefaultSettings();
    }
    return parsed as PluginSettings;
  } catch {
    return getDefaultSettings();
  }
}

export async function saveSettings(path: string, settings: PluginSettings): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmpPath = join(dir, `.settings-${Date.now()}.tmp`);
  await Bun.write(tmpPath, JSON.stringify(settings, null, 2));
  await rename(tmpPath, path);
}
