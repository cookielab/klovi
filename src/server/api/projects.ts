import type { PluginRegistry } from "../../plugins/registry.ts";

export async function handleProjects(registry: PluginRegistry): Promise<Response> {
  const projects = await registry.discoverAllProjects();
  return Response.json({ projects });
}
