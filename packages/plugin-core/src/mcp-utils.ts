// Parse an MCP-style `mcp__<server>__<tool>` raw name into a human-readable label.
const MCP_FULL_PARTS = 3;
const MCP_SERVER_ONLY_PARTS = 2;
const MCP_TOOL_START_INDEX = 2;

export function parseMcpDisplayName(rawName: string): string {
	const parts = rawName.split("__");
	// parts[0] = "mcp", parts[1] = server, parts[2..] = tool segments
	if (parts.length >= MCP_FULL_PARTS) {
		return parts.slice(MCP_TOOL_START_INDEX).join("_");
	}
	if (parts.length === MCP_SERVER_ONLY_PARTS && parts[1]) {
		return parts[1];
	}
	return rawName;
}
