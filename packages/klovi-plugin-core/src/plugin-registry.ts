import { maxIso, sortByIsoDesc } from "./iso-time.ts";
import type {
  MergedProject,
  PluginProject,
  RegistrySession,
  RegistrySessionSummary,
  ToolPlugin,
} from "./plugin-types.ts";
import { encodeSessionId } from "./session-id.ts";

export type SessionIdEncoder<TPluginId extends string> = (
  pluginId: TPluginId,
  rawSessionId: string,
) => string;

export function encodeResolvedPath(resolvedPath: string): string {
  // Convert /Users/foo/bar -> -Users-foo-bar (same scheme as Claude Code)
  if (resolvedPath.startsWith("/")) {
    return resolvedPath.replace(/\//g, "-");
  }

  return resolvedPath.replace(/[/\\:]/g, "-");
}

interface RegistryOptions<TPluginId extends string> {
  encodeSessionId?: SessionIdEncoder<TPluginId>;
}

export class PluginRegistry<
  TPluginId extends string = string,
  TSessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
  TSession extends RegistrySession = RegistrySession,
> {
  private readonly plugins = new Map<TPluginId, ToolPlugin<TPluginId, TSessionSummary, TSession>>();

  private readonly sessionIdEncoder: SessionIdEncoder<TPluginId>;

  constructor(options: RegistryOptions<TPluginId> = {}) {
    this.sessionIdEncoder =
      options.encodeSessionId ??
      ((pluginId, rawSessionId) => encodeSessionId(pluginId, rawSessionId));
  }

  register(plugin: ToolPlugin<TPluginId, TSessionSummary, TSession>): void {
    this.plugins.set(plugin.id, plugin);
  }

  getPlugin(id: string): ToolPlugin<TPluginId, TSessionSummary, TSession> {
    const plugin = this.plugins.get(id as TPluginId);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);
    return plugin;
  }

  getAllPlugins(): ToolPlugin<TPluginId, TSessionSummary, TSession>[] {
    return [...this.plugins.values()];
  }

  async discoverAllProjects(): Promise<MergedProject<TPluginId>[]> {
    const allProjects: PluginProject<TPluginId>[] = [];

    for (const plugin of this.plugins.values()) {
      try {
        const projects = await plugin.discoverProjects();
        allProjects.push(...projects);
      } catch {
        // Discovery failure for one plugin should not fail the whole registry call.
      }
    }

    const projectsByPath = new Map<string, PluginProject<TPluginId>[]>();
    for (const project of allProjects) {
      const current = projectsByPath.get(project.resolvedPath);
      if (current) {
        current.push(project);
      } else {
        projectsByPath.set(project.resolvedPath, [project]);
      }
    }

    const merged: MergedProject<TPluginId>[] = [];
    for (const [resolvedPath, projects] of projectsByPath) {
      merged.push({
        encodedPath: encodeResolvedPath(resolvedPath),
        resolvedPath,
        name: resolvedPath,
        fullPath: resolvedPath,
        sessionCount: projects.reduce((sum, project) => sum + project.sessionCount, 0),
        lastActivity: maxIso(projects.map((project) => project.lastActivity)),
        sources: projects.map((project) => ({
          pluginId: project.pluginId,
          nativeId: project.nativeId,
        })),
      });
    }

    sortByIsoDesc(merged, (project) => project.lastActivity);
    return merged;
  }

  async listAllSessions(project: MergedProject<TPluginId>): Promise<TSessionSummary[]> {
    const allSessions: TSessionSummary[] = [];

    for (const source of project.sources) {
      const plugin = this.plugins.get(source.pluginId);
      if (!plugin) continue;

      try {
        const sessions = await plugin.listSessions(source.nativeId);
        allSessions.push(
          ...sessions.map(
            (session) =>
              ({
                ...session,
                sessionId: this.sessionIdEncoder(source.pluginId, session.sessionId),
                pluginId: source.pluginId,
              }) as TSessionSummary,
          ),
        );
      } catch {
        // Session listing failure for one source should not fail the whole registry call.
      }
    }

    sortByIsoDesc(allSessions, (session) => session.timestamp);
    return allSessions;
  }
}
