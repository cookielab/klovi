import type { Effect } from "effect";
import type { PluginError } from "./plugin-errors.ts";
import type { PluginRequirements } from "./plugin-runtime.ts";

export type PluginProject<TPluginId extends string = string> = {
	pluginId: TPluginId;
	nativeId: string;
	resolvedPath: string;
	displayName: string;
	sessionCount: number;
	lastActivity: string;
};

export type ProjectSource<TPluginId extends string = string> = {
	pluginId: TPluginId;
	nativeId: string;
};

export type MergedProject<TPluginId extends string = string> = {
	encodedPath: string;
	resolvedPath: string;
	name: string;
	fullPath: string;
	sessionCount: number;
	lastActivity: string;
	sources: ProjectSource<TPluginId>[];
};

export type Badge = {
	label: string;
	className: string;
};

export type RegistrySessionSummary = {
	sessionId: string;
	timestamp: string;
	pluginId?: string | undefined;
};

export type RegistrySession = {
	sessionId: string;
};

export type ToolPluginSessionDetail<TSession extends RegistrySession = RegistrySession> = {
	session: TSession;
	planSessionId?: string | undefined;
	implSessionId?: string | undefined;
};

export type ToolPluginSubAgentParams = {
	sessionId: string;
	project: string;
	agentId: string;
};

export type ToolPlugin<
	TPluginId extends string = string,
	TSessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
	TSession extends RegistrySession = RegistrySession,
> = {
	readonly id: TPluginId;
	readonly displayName: string;

	getDefaultDataDir: () => string | null;
	readonly isDataAvailable: Effect.Effect<boolean, never, PluginRequirements>;
	readonly discoverProjects: Effect.Effect<PluginProject<TPluginId>[], PluginError, PluginRequirements>;
	listSessions: (nativeId: string) => Effect.Effect<TSessionSummary[], PluginError, PluginRequirements>;
	loadSession: (nativeId: string, sessionId: string) => Effect.Effect<TSession, PluginError, PluginRequirements>;
	loadSessionDetail?: (
		nativeId: string,
		sessionId: string,
	) => Effect.Effect<ToolPluginSessionDetail<TSession>, PluginError, PluginRequirements>;
	loadSubAgentSession?: (params: ToolPluginSubAgentParams) => Effect.Effect<TSession, PluginError, PluginRequirements>;

	getResumeCommand?: (sessionId: string) => string | null;
	getSessionBadges?: (session: TSessionSummary) => Badge[];
};
