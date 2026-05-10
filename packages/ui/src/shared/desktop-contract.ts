import type { PluginSettingInfo, UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "./rpc-types";
import type {
	DashboardStats,
	GlobalSessionResult,
	Project,
	Session,
	SessionSummary,
	StatsResponse,
	Turn,
} from "./types";

type EmptyPayload = Record<string, never>;

type DesktopRequestDefinition<TParams, TResponse> = {
	params: TParams;
	response: TResponse;
};

type DesktopRequestArgs<T extends DesktopRequestDefinition<unknown, unknown>> = T["params"] extends EmptyPayload
	? []
	: [T["params"]];

type DesktopMenuAction = "cycleTheme" | "increaseFontSize" | "decreaseFontSize" | "togglePresentation" | "openSettings";

type DesktopHostRequestMap = {
	browseDirectory: DesktopRequestDefinition<{ startingFolder?: string }, { path: string | null }>;
	getUpdateSettings: DesktopRequestDefinition<EmptyPayload, UpdateSettingsInfo>;
	updateUpdateSettings: DesktopRequestDefinition<
		{ channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean },
		UpdateSettingsInfo
	>;
	checkForUpdate: DesktopRequestDefinition<EmptyPayload, UpdateStatus>;
	applyUpdate: DesktopRequestDefinition<EmptyPayload, { ok: boolean; error?: string }>;
	openExternal: DesktopRequestDefinition<{ url: string }, { ok: boolean }>;
	getSystemTheme: DesktopRequestDefinition<EmptyPayload, { theme: "dark" | "light" | null }>;
};

type DesktopClientRequestMap = {
	acceptRisks: DesktopRequestDefinition<EmptyPayload, { ok: boolean }>;
	isFirstLaunch: DesktopRequestDefinition<EmptyPayload, { firstLaunch: boolean }>;
	getVersion: DesktopRequestDefinition<EmptyPayload, { version: string; commit: string }>;
	getStats: DesktopRequestDefinition<EmptyPayload, StatsResponse>;
	getProjects: DesktopRequestDefinition<EmptyPayload, { projects: Project[] }>;
	getSessions: DesktopRequestDefinition<{ encodedPath: string }, { sessions: SessionSummary[] }>;
	getSession: DesktopRequestDefinition<{ sessionId: string; project: string }, { session: Session }>;
	getSessionHead: DesktopRequestDefinition<
		{ sessionId: string; project: string; headSize?: number },
		{ session: Session; totalTurns: number }
	>;
	getSessionTail: DesktopRequestDefinition<{ sessionId: string; project: string; fromTurn: number }, { turns: Turn[] }>;
	getSubAgent: DesktopRequestDefinition<{ sessionId: string; project: string; agentId: string }, { session: Session }>;
	searchSessions: DesktopRequestDefinition<EmptyPayload, { sessions: GlobalSessionResult[] }>;
	getPluginSettings: DesktopRequestDefinition<EmptyPayload, { plugins: PluginSettingInfo[] }>;
	updatePluginSetting: DesktopRequestDefinition<
		{ pluginId: string; enabled?: boolean; dataDir?: string | null },
		{ plugins: PluginSettingInfo[] }
	>;
	getGeneralSettings: DesktopRequestDefinition<EmptyPayload, { showSecurityWarning: boolean }>;
	updateGeneralSettings: DesktopRequestDefinition<{ showSecurityWarning?: boolean }, { showSecurityWarning: boolean }>;
	resetSettings: DesktopRequestDefinition<EmptyPayload, { ok: boolean }>;
};

type DesktopRequestMap = DesktopHostRequestMap & DesktopClientRequestMap;

type DesktopHostRequestMethod = keyof DesktopHostRequestMap;
type DesktopClientRequestMethod = keyof DesktopClientRequestMap;
type DesktopRequestMethod = keyof DesktopRequestMap;

type DesktopWebviewMessageMap = {
	cycleTheme: EmptyPayload;
	increaseFontSize: EmptyPayload;
	decreaseFontSize: EmptyPayload;
	togglePresentation: EmptyPayload;
	openSettings: EmptyPayload;
	updateStatus: UpdateStatus;
	checkForUpdatesResult: UpdateStatus;
	statsUpdated: { stats: DashboardStats };
	systemThemeChanged: { theme: "dark" | "light" };
};

export type {
	DesktopClientRequestMap,
	DesktopClientRequestMethod,
	DesktopHostRequestMap,
	DesktopHostRequestMethod,
	DesktopMenuAction,
	DesktopRequestArgs,
	DesktopRequestMap,
	DesktopRequestMethod,
	DesktopWebviewMessageMap,
	EmptyPayload,
};
