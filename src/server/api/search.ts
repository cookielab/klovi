import type { PluginRegistry } from "../../plugins/registry.ts";
import { sortByIsoDesc } from "../../shared/iso-time.ts";

export async function handleSearchSessions(registry: PluginRegistry): Promise<Response> {
  const projects = await registry.discoverAllProjects();
  const allSessions = [];

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
  return Response.json({ sessions: allSessions });
}

function projectNameFromPath(fullPath: string): string {
  const parts = fullPath.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}
