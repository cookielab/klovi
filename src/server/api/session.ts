import { parseSession } from "../parser/session.ts";

export async function handleSession(
  sessionId: string,
  encodedPath: string
): Promise<Response> {
  const session = await parseSession(sessionId, encodedPath);
  return Response.json({ session });
}
