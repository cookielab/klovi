// Parse an MCP-style `mcp__<server>__<tool>` raw name into a human-readable label.
export function parseMcpDisplayName(rawName: string): string {
	const parts = rawName.split("__");
	// parts[0] = "mcp", parts[1] = server, parts[2..] = tool segments
	if (parts.length >= 3) {
		return parts.slice(2).join("_");
	}
	if (parts.length === 2 && parts[1]) {
		return parts[1];
	}
	return rawName;
}
