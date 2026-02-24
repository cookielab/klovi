import type { PluginRegistry } from "../../plugins/registry.ts";

export async function handleSessions(
  encodedPath: string,
  registry: PluginRegistry,
): Promise<Response> {
  const projects = await registry.discoverAllProjects();
  const project = projects.find((p) => p.encodedPath === encodedPath);
  if (!project) return Response.json({ sessions: [] });
  const sessions = await registry.listAllSessions(project);
  return Response.json({ sessions });
}
