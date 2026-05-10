import type { Effect } from "effect";
import type { PluginError } from "./plugin-errors";
import type { PluginRequirements } from "./plugin-runtime";

export type PluginProject<TpluginId extends string = string> = {
	pluginId: TpluginId;
	nativeId: string;
	resolvedPath: string;
	displayName: string;
	sessionCount: number;
	lastActivity: string;
};

export type PluginDiscoveryIndex<
	TpluginId extends string = string,
	TsessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
> = {
	projects: PluginProject<TpluginId>[];
	sessionsByNativeId: Map<string, TsessionSummary[]>;
};

export type ProjectSource<TpluginId extends string = string> = {
	pluginId: TpluginId;
	nativeId: string;
};

export type MergedProject<TpluginId extends string = string> = {
	encodedPath: string;
	resolvedPath: string;
	name: string;
	fullPath: string;
	sessionCount: number;
	lastActivity: string;
	sources: ProjectSource<TpluginId>[];
};

export type RegistrySessionSummary = {
	sessionId: string;
	timestamp: string;
	pluginId?: string | undefined;
};

export type RegistrySession = {
	sessionId: string;
};

export type ToolPluginSessionDetail<Tsession extends RegistrySession = RegistrySession> = {
	session: Tsession;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
};

export type ToolPluginSubAgentParams = {
	sessionId: string;
	project: string;
	agentId: string;
};

export type ToolPlugin<
	TpluginId extends string = string,
	TsessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
	Tsession extends RegistrySession = RegistrySession,
> = {
	readonly id: TpluginId;
	readonly displayName: string;

	getDefaultDataDir: () => string | null;
	readonly isDataAvailable: Effect.Effect<boolean, never, PluginRequirements>;
	readonly discoverProjects: Effect.Effect<PluginProject<TpluginId>[], PluginError, PluginRequirements>;
	readonly discoverIndex?: Effect.Effect<
		PluginDiscoveryIndex<TpluginId, TsessionSummary>,
		PluginError,
		PluginRequirements
	>;
	listSessions: (nativeId: string) => Effect.Effect<TsessionSummary[], PluginError, PluginRequirements>;
	loadSession: (nativeId: string, sessionId: string) => Effect.Effect<Tsession, PluginError, PluginRequirements>;
	loadSessionDetail?: (
		nativeId: string,
		sessionId: string,
	) => Effect.Effect<ToolPluginSessionDetail<Tsession>, PluginError, PluginRequirements>;
	loadSubAgentSession?: (params: ToolPluginSubAgentParams) => Effect.Effect<Tsession, PluginError, PluginRequirements>;

	getResumeCommand?: (sessionId: string) => string | null;
};
