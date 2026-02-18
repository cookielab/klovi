import { encodeSessionId, parseSessionId } from "../../shared/session-id.ts";
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
  const parsed = parseSessionId(sessionId);
  const rawSessionId = parsed.rawSessionId;

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === encodedPath);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  // Backward compatibility: if plugin prefix is missing, infer when possible.
  const pluginId =
    parsed.pluginId ?? (project.sources.length === 1 ? project.sources[0]!.pluginId : "claude-code");

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) return Response.json({ error: "Plugin source not found" }, { status: 404 });

  const plugin = registry.getPlugin(pluginId);

  // Claude Code-specific: use loadClaudeSession for slug access and plan/impl linking
  if (pluginId === "claude-code") {
    const [{ session, slug }, sessions] = await Promise.all([
      loadClaudeSession(source.nativeId, rawSessionId),
      plugin.listSessions(source.nativeId),
    ]);

    const planRawId = findPlanSessionId(session.turns, slug, sessions, rawSessionId);
    const implRawId = findImplSessionId(slug, sessions, rawSessionId);

    session.sessionId = encodeSessionId(pluginId, rawSessionId);
    session.planSessionId = planRawId ? encodeSessionId(pluginId, planRawId) : undefined;
    session.implSessionId = implRawId ? encodeSessionId(pluginId, implRawId) : undefined;

    return Response.json({ session });
  }

  // Generic plugin path
  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.sessionId = encodeSessionId(pluginId, rawSessionId);
  session.pluginId = pluginId;
  return Response.json({ session });
}
