import type { MergedProject, PluginProject, ToolPlugin } from "../shared/plugin-types.ts";
import type { SessionSummary } from "../shared/types.ts";

function encodeResolvedPath(resolvedPath: string): string {
  // Convert /Users/foo/bar → -Users-foo-bar (same scheme as Claude Code)
  if (resolvedPath.startsWith("/")) {
    return resolvedPath.replace(/\//g, "-");
  }
  return resolvedPath.replace(/[/\\:]/g, "-");
}

export class PluginRegistry {
  private plugins = new Map<string, ToolPlugin>();

  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  getPlugin(id: string): ToolPlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin not found: ${id}`);
    return plugin;
  }

  getAllPlugins(): ToolPlugin[] {
    return [...this.plugins.values()];
  }

  async discoverAllProjects(): Promise<MergedProject[]> {
    const allProjects: PluginProject[] = [];
    for (const plugin of this.plugins.values()) {
      try {
        const projects = await plugin.discoverProjects();
        allProjects.push(...projects);
      } catch {
        // Plugin discovery failed, skip it
      }
    }

    // Group by resolvedPath
    const byPath = new Map<string, PluginProject[]>();
    for (const p of allProjects) {
      const existing = byPath.get(p.resolvedPath) ?? [];
      existing.push(p);
      byPath.set(p.resolvedPath, existing);
    }

    // Merge into MergedProject
    const merged: MergedProject[] = [];
    for (const [resolvedPath, projects] of byPath) {
      const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
      const latestActivity =
        projects
          .map((p) => p.lastActivity)
          .sort()
          .pop() ?? "";

      merged.push({
        encodedPath: encodeResolvedPath(resolvedPath),
        resolvedPath,
        name: resolvedPath,
        fullPath: resolvedPath,
        sessionCount: totalSessions,
        lastActivity: latestActivity,
        sources: projects.map((p) => ({
          pluginId: p.pluginId,
          nativeId: p.nativeId,
        })),
      });
    }

    merged.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    return merged;
  }

  async listAllSessions(project: MergedProject): Promise<SessionSummary[]> {
    const allSessions: SessionSummary[] = [];

    for (const source of project.sources) {
      const plugin = this.plugins.get(source.pluginId);
      if (!plugin) continue;
      try {
        const sessions = await plugin.listSessions(source.nativeId);
        allSessions.push(...sessions);
      } catch {
        // Plugin session listing failed, skip it
      }
    }

    allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return allSessions;
  }
}
