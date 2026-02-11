import { listSessions } from "../parser/claude-dir.ts";
import { findPlanSessionId, parseSession } from "../parser/session.ts";

export async function handleSession(sessionId: string, encodedPath: string): Promise<Response> {
  const [{ session, slug }, sessions] = await Promise.all([
    parseSession(sessionId, encodedPath),
    listSessions(encodedPath),
  ]);

  session.planSessionId = findPlanSessionId(session.turns, slug, sessions, sessionId);

  return Response.json({ session });
}
