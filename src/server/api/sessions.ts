import { listSessions } from "../parser/claude-dir.ts";

export async function handleSessions(
  encodedPath: string
): Promise<Response> {
  const sessions = await listSessions(encodedPath);
  return Response.json({ sessions });
}
