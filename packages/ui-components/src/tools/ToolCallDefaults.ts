import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { ToolCallWithResult } from "../types/index";


const MAX_OUTPUT_LENGTH = 5000;
const MAX_THINKING_PREVIEW = 100;

function truncateOutput(s: string): string {
	if (s.length <= MAX_OUTPUT_LENGTH) {
		return s;
	}
	return s.slice(0, MAX_OUTPUT_LENGTH);
}

function getToolSummary(
	call: ToolCallWithResult,
	getFrontendPlugin?: (id: string) => FrontendPlugin | undefined,
	pluginId?: string,
): string {
	// Prefer canonical field set by parser
	if (call.summary !== undefined) {
		return call.summary;
	}
	// Plugin shim (kept for Task 4 removal)
	if (pluginId && getFrontendPlugin) {
		const plugin = getFrontendPlugin(pluginId);
		const pluginExtractor = plugin?.summaryExtractors[call.name];
		if (pluginExtractor) {
			return pluginExtractor(call.input);
		}
	}
	// MCP fallback for plugins that don't set summary
	if (call.kind === "mcp" && call.rawName) {
		return call.rawName.split("__").slice(2).join(" > ") || "";
	}
	return "";
}

function hasInputFormatter(
	call: ToolCallWithResult,
	getFrontendPlugin?: (id: string) => FrontendPlugin | undefined,
	pluginId?: string,
): boolean {
	if (call.formattedInput !== undefined) {
		return true;
	}
	if (pluginId && getFrontendPlugin) {
		const plugin = getFrontendPlugin(pluginId);
		if (plugin?.inputFormatters[call.name]) {
			return true;
		}
	}
	return false;
}

function formatToolInput(
	call: ToolCallWithResult,
	getFrontendPlugin?: (id: string) => FrontendPlugin | undefined,
	pluginId?: string,
): string {
	// Prefer canonical field set by parser
	if (call.formattedInput !== undefined) {
		return call.formattedInput;
	}
	// Plugin shim (kept for Task 4 removal)
	if (pluginId && getFrontendPlugin) {
		const plugin = getFrontendPlugin(pluginId);
		const pluginFormatter = plugin?.inputFormatters[call.name];
		if (pluginFormatter) {
			return pluginFormatter(call.input);
		}
	}
	// JSON fallback
	return JSON.stringify(call.input, null, 2);
}

export { formatToolInput, getToolSummary, hasInputFormatter, MAX_OUTPUT_LENGTH, MAX_THINKING_PREVIEW, truncateOutput };
