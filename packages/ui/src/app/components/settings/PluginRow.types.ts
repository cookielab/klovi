import type { PluginSettingInfo } from "../../../shared/rpc-types";

export type PluginRowProps = {
	plugin: PluginSettingInfo;
	onToggle: (pluginId: string, enabled: boolean) => void;
	onBrowse: (pluginId: string, currentDir: string) => void;
	onPathChange: (pluginId: string, dataDir: string) => void;
	onReset: (pluginId: string) => void;
	canBrowse?: boolean;
};
