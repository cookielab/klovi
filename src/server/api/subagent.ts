import { parseSubAgentSession } from "../../plugins/claude-code/parser.ts";
import { parseSessionId } from "../../shared/session-id.ts";

export async function handleSubAgent(
  sessionId: string,
  agentId: string,
  encodedPath: string,
): Promise<Response> {
  const parsed = parseSessionId(sessionId);
  if (parsed.pluginId !== "claude-code") {
    return Response.json(
      { error: "sessionId must include claude-code prefix for sub-agent sessions" },
      { status: 400 },
    );
  }

  if (!parsed.rawSessionId) {
    return Response.json(
      { error: "sessionId must include a raw session id after claude-code::" },
      { status: 400 },
    );
  }

  try {
    const session = await parseSubAgentSession(parsed.rawSessionId, encodedPath, agentId);
    return Response.json({ session });
  } catch {
    return Response.json({ error: "Sub-agent not found" }, { status: 404 });
  }
}
