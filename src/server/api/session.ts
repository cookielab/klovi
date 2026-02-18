import type { PluginRegistry } from "../plugin-registry.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
} from "../plugins/claude-code/parser.ts";

export async function handleSession(
  sessionId: string,
  encodedPath: string,
  registry: PluginRegistry,
): Promise<Response> {
  // Parse compound session ID: "claude-code::abc123"
  const separatorIdx = sessionId.indexOf("::");
  let pluginId: string;
  let rawSessionId: string;

  if (separatorIdx !== -1) {
    pluginId = sessionId.slice(0, separatorIdx);
    rawSessionId = sessionId.slice(separatorIdx + 2);
  } else {
    // Backward compatibility: assume Claude Code
    pluginId = "claude-code";
    rawSessionId = sessionId;
  }

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === encodedPath);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) return Response.json({ error: "Plugin source not found" }, { status: 404 });

  const plugin = registry.getPlugin(pluginId);

  // Claude Code-specific: use loadClaudeSession for slug access and plan/impl linking
  if (pluginId === "claude-code") {
    const [{ session, slug }, sessions] = await Promise.all([
      loadClaudeSession(source.nativeId, rawSessionId),
      plugin.listSessions(source.nativeId),
    ]);

    session.planSessionId = findPlanSessionId(session.turns, slug, sessions, rawSessionId);
    session.implSessionId = findImplSessionId(slug, sessions, rawSessionId);

    return Response.json({ session });
  }

  // Generic plugin path
  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.pluginId = pluginId;
  return Response.json({ session });
}
