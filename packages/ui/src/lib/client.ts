import type { PluginSettingInfo } from "../shared/rpc-types.ts";
import type { DashboardStats, GlobalSessionResult, Project, Session, SessionSummary } from "../shared/types.ts";

export type KloviClient = {
	acceptRisks: () => Promise<{ ok: boolean }>;
	isFirstLaunch: () => Promise<{ firstLaunch: boolean }>;
	getVersion: () => Promise<{ version: string; commit: string }>;
	getStats: () => Promise<{ stats: DashboardStats }>;
	getProjects: () => Promise<{ projects: Project[] }>;
	getSessions: (params: { encodedPath: string }) => Promise<{ sessions: SessionSummary[] }>;
	getSession: (params: { sessionId: string; project: string }) => Promise<{ session: Session }>;
	getSubAgent: (params: { sessionId: string; project: string; agentId: string }) => Promise<{ session: Session }>;
	searchSessions: () => Promise<{ sessions: GlobalSessionResult[] }>;
	getPluginSettings: () => Promise<{ plugins: PluginSettingInfo[] }>;
	updatePluginSetting: (params: {
		pluginId: string;
		enabled?: boolean;
		dataDir?: string | null;
	}) => Promise<{ plugins: PluginSettingInfo[] }>;
	getGeneralSettings: () => Promise<{ showSecurityWarning: boolean }>;
	updateGeneralSettings: (params: { showSecurityWarning?: boolean }) => Promise<{ showSecurityWarning: boolean }>;
	resetSettings: () => Promise<{ ok: boolean }>;
};
