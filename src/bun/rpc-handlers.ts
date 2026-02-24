import { scanStats } from "../parser/stats.ts";
import {
  findImplSessionId,
  findPlanSessionId,
  loadClaudeSession,
  parseSubAgentSession,
} from "../plugins/claude-code/parser.ts";
import type { PluginRegistry } from "../plugins/registry.ts";
import { sortByIsoDesc } from "../shared/iso-time.ts";
import type { VersionInfo } from "../shared/rpc-types.ts";
import { encodeSessionId, parseSessionId } from "../shared/session-id.ts";
import type { GlobalSessionResult, SessionSummary } from "../shared/types.ts";

export function getVersion(): VersionInfo {
  return {
    version: process.env.KLOVI_VERSION ?? "dev",
    commit: process.env.KLOVI_COMMIT ?? "",
  };
}

export async function getStats(registry: PluginRegistry) {
  const stats = await scanStats(registry);
  return { stats };
}

export async function getProjects(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  return { projects };
}

export async function getSessions(registry: PluginRegistry, params: { encodedPath: string }) {
  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.encodedPath);
  if (!project) return { sessions: [] as SessionSummary[] };
  const sessions = await registry.listAllSessions(project);
  return { sessions };
}

export async function getSession(
  registry: PluginRegistry,
  params: { sessionId: string; project: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (!parsed.pluginId || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format");
  }

  const pluginId = parsed.pluginId;
  const rawSessionId = parsed.rawSessionId;

  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === params.project);
  if (!project) throw new Error("Project not found");

  const source = project.sources.find((s) => s.pluginId === pluginId);
  if (!source) throw new Error("Plugin source not found");

  const plugin = registry.getPlugin(pluginId);

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

    return { session };
  }

  const session = await plugin.loadSession(source.nativeId, rawSessionId);
  session.sessionId = encodeSessionId(pluginId, rawSessionId);
  session.pluginId = pluginId;
  return { session };
}

export async function getSubAgent(
  _registry: PluginRegistry,
  params: { sessionId: string; project: string; agentId: string },
) {
  const parsed = parseSessionId(params.sessionId);
  if (parsed.pluginId !== "claude-code" || !parsed.rawSessionId) {
    throw new Error("Invalid sessionId format for sub-agent");
  }
  const session = await parseSubAgentSession(parsed.rawSessionId, params.project, params.agentId);
  return { session };
}

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

export async function searchSessions(registry: PluginRegistry) {
  const projects = await registry.discoverAllProjects();
  const allSessions: GlobalSessionResult[] = [];

  for (const project of projects) {
    const sessions = await registry.listAllSessions(project);
    const projectName = projectNameFromPath(project.name);
    for (const session of sessions) {
      allSessions.push({
        ...session,
        encodedPath: project.encodedPath,
        projectName,
      });
    }
  }

  sortByIsoDesc(allSessions, (session) => session.timestamp);
  return { sessions: allSessions };
}
