import type { PluginSettingInfo } from "@cookielab.io/klovi-server/services/settings-service";
import type {
	DashboardStats,
	GlobalSessionResult,
	Project,
	Session,
	SessionSummary,
} from "@cookielab.io/klovi-ui/bootstrap";
import type { RPCSchema } from "electrobun/bun";

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

export type KloviRPC = {
	bun: RPCSchema<{
		requests: {
			// Native host bridge methods
			browseDirectory: {
				params: { startingFolder?: string };
				response: { path: string | null };
			};
			getUpdateSettings: {
				params: Record<string, never>;
				response: UpdateSettingsInfo;
			};
			updateUpdateSettings: {
				params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean };
				response: UpdateSettingsInfo;
			};
			checkForUpdate: {
				params: Record<string, never>;
				response: UpdateStatus;
			};
			applyUpdate: {
				params: Record<string, never>;
				response: { ok: boolean; error?: string };
			};
			openExternal: { params: { url: string }; response: { ok: boolean } };

			// Data methods (KloviClient interface)
			acceptRisks: {
				params: Record<string, never>;
				response: { ok: boolean };
			};
			isFirstLaunch: {
				params: Record<string, never>;
				response: { firstLaunch: boolean };
			};
			getVersion: {
				params: Record<string, never>;
				response: { version: string; commit: string };
			};
			getStats: {
				params: Record<string, never>;
				response: { stats: DashboardStats };
			};
			getProjects: {
				params: Record<string, never>;
				response: { projects: Project[] };
			};
			getSessions: {
				params: { encodedPath: string };
				response: { sessions: SessionSummary[] };
			};
			getSession: {
				params: { sessionId: string; project: string };
				response: { session: Session };
			};
			getSubAgent: {
				params: { sessionId: string; project: string; agentId: string };
				response: { session: Session };
			};
			searchSessions: {
				params: Record<string, never>;
				response: { sessions: GlobalSessionResult[] };
			};
			getPluginSettings: {
				params: Record<string, never>;
				response: { plugins: PluginSettingInfo[] };
			};
			updatePluginSetting: {
				params: { pluginId: string; enabled?: boolean; dataDir?: string | null };
				response: { plugins: PluginSettingInfo[] };
			};
			getGeneralSettings: {
				params: Record<string, never>;
				response: { showSecurityWarning: boolean };
			};
			updateGeneralSettings: {
				params: { showSecurityWarning?: boolean };
				response: { showSecurityWarning: boolean };
			};
			resetSettings: {
				params: Record<string, never>;
				response: { ok: boolean };
			};
			getSystemTheme: {
				params: Record<string, never>;
				response: { theme: "dark" | "light" | null };
			};
		};
		messages: Record<string, never>;
	}>;
	webview: RPCSchema<{
		requests: Record<string, never>;
		messages: {
			cycleTheme: Record<string, never>;
			increaseFontSize: Record<string, never>;
			decreaseFontSize: Record<string, never>;
			togglePresentation: Record<string, never>;
			openSettings: Record<string, never>;
			updateStatus: UpdateStatus;
			checkForUpdatesResult: UpdateStatus;
			systemThemeChanged: { theme: "dark" | "light" };
		};
	}>;
};
