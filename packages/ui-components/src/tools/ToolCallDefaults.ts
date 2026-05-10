import type { ToolCallWithResult } from "../types/index";

const MAX_OUTPUT_LENGTH = 5000;
const MAX_THINKING_PREVIEW = 100;

function truncateOutput(s: string): string {
	if (s.length <= MAX_OUTPUT_LENGTH) {
		return s;
	}
	return s.slice(0, MAX_OUTPUT_LENGTH);
}

function getToolSummary(call: ToolCallWithResult): string {
	if (call.summary !== undefined) {
		return call.summary;
	}
	// MCP fallback for plugins that don't set summary
	if (call.kind === "mcp" && call.rawName) {
		return call.rawName.split("__").slice(2).join(" > ") || "";
	}
	return "";
}

function hasInputFormatter(call: ToolCallWithResult): boolean {
	return call.formattedInput !== undefined;
}

function formatToolInput(call: ToolCallWithResult): string {
	if (call.formattedInput !== undefined) {
		return call.formattedInput;
	}
	// JSON fallback
	return JSON.stringify(call.input, null, 2);
}

export { formatToolInput, getToolSummary, hasInputFormatter, MAX_OUTPUT_LENGTH, MAX_THINKING_PREVIEW, truncateOutput };
