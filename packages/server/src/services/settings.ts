import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BUILTIN_KLOVI_PLUGIN_IDS } from "@cookielab.io/klovi-plugin-core";

type UpdateChannel = "stable" | "candidate" | "beta";

type UpdateSettings = {
	channel: UpdateChannel;
	checkIntervalHours: number;
	autoDownload: boolean;
};

type PluginSettings = {
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
	return Object.fromEntries(BUILTIN_KLOVI_PLUGIN_IDS.map((pluginId) => [pluginId, { enabled: true, dataDir: null }]));
}

function getDefaultSettings(): PluginSettings {
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

async function loadSettings(path: string): Promise<PluginSettings> {
	try {
		const content = await readFile(path, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;
		if (parsed["version"] !== 1 || typeof parsed["plugins"] !== "object") {
			return getDefaultSettings();
		}
		return parsed as unknown as PluginSettings;
	} catch {
		return getDefaultSettings();
	}
}

async function saveSettings(path: string, settings: PluginSettings): Promise<void> {
	const dir = dirname(path);
	await mkdir(dir, { recursive: true });
	const tmpPath = join(dir, `.settings-${Date.now()}.tmp`);
	await writeFile(tmpPath, JSON.stringify(settings, null, 2));
	await rename(tmpPath, path);
}

export type { PluginSettings, UpdateChannel, UpdateSettings };
export { getDefaultSettings, loadSettings, saveSettings };
