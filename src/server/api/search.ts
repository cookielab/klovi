import { listAllSessions } from "../parser/claude-dir.ts";

export async function handleSearchSessions(): Promise<Response> {
  const sessions = await listAllSessions();
  return Response.json({ sessions });
}
