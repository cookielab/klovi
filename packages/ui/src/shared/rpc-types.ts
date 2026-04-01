export type VersionInfo = {
	version: string;
	commit: string;
};

export type PluginSettingInfo = {
	id: string;
	displayName: string;
	enabled: boolean;
	dataDir: string;
	defaultDataDir: string;
	isCustomDir: boolean;
};

export type UpdateChannel = "stable" | "candidate" | "beta";

export type UpdateSettingsInfo = {
	channel: UpdateChannel;
	checkIntervalHours: number;
	autoDownload: boolean;
};

export type UpdateStatus = {
	status: "up-to-date" | "available" | "downloading" | "ready" | "error";
	currentVersion: string;
	latestVersion?: string;
	progress?: number;
	error?: string;
};
