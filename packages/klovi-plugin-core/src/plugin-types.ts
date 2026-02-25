export interface PluginProject<TPluginId extends string = string> {
  pluginId: TPluginId;
  nativeId: string;
  resolvedPath: string;
  displayName: string;
  sessionCount: number;
  lastActivity: string;
}

export interface ProjectSource<TPluginId extends string = string> {
  pluginId: TPluginId;
  nativeId: string;
}

export interface MergedProject<TPluginId extends string = string> {
  encodedPath: string;
  resolvedPath: string;
  name: string;
  fullPath: string;
  sessionCount: number;
  lastActivity: string;
  sources: ProjectSource<TPluginId>[];
}

export interface Badge {
  label: string;
  className: string;
}

export interface RegistrySessionSummary {
  sessionId: string;
  timestamp: string;
  pluginId?: string | undefined;
}

export interface RegistrySession {
  sessionId: string;
}

export interface ToolPluginSessionDetail<TSession extends RegistrySession = RegistrySession> {
  session: TSession;
  planSessionId?: string | undefined;
  implSessionId?: string | undefined;
}

export interface ToolPluginSubAgentParams {
  sessionId: string;
  project: string;
  agentId: string;
}

export interface ToolPlugin<
  TPluginId extends string = string,
  TSessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
  TSession extends RegistrySession = RegistrySession,
> {
  id: TPluginId;
  displayName: string;

  getDefaultDataDir(): string | null;
  isDataAvailable?(): boolean;
  discoverProjects(): Promise<PluginProject<TPluginId>[]>;
  listSessions(nativeId: string): Promise<TSessionSummary[]>;
  loadSession(nativeId: string, sessionId: string): Promise<TSession>;
  loadSessionDetail?(
    nativeId: string,
    sessionId: string,
  ): Promise<ToolPluginSessionDetail<TSession>>;
  loadSubAgentSession?(params: ToolPluginSubAgentParams): Promise<TSession>;

  getResumeCommand?(sessionId: string): string | null;
  getSessionBadges?(session: TSessionSummary): Badge[];
}
