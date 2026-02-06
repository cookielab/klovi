import { discoverProjects } from "../parser/claude-dir.ts";

export async function handleProjects(): Promise<Response> {
  const projects = await discoverProjects();
  return Response.json({ projects });
}
