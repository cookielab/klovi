import { parseSubAgentSession } from "../plugins/claude-code/parser.ts";

export async function handleSubAgent(
  sessionId: string,
  agentId: string,
  encodedPath: string,
): Promise<Response> {
  try {
    const session = await parseSubAgentSession(sessionId, encodedPath, agentId);
    return Response.json({ session });
  } catch {
    return Response.json({ error: "Sub-agent not found" }, { status: 404 });
  }
}
