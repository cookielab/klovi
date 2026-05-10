import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { ToolCallWithResult } from "../types/index";
import {
	formatToolInput,
	getToolSummary,
	hasInputFormatter,
	MAX_OUTPUT_LENGTH,
	truncateOutput,
} from "./ToolCallDefaults";


const N_10 = 10;

function call(name: string, input: Record<string, unknown> = {}, overrides: Partial<ToolCallWithResult> = {}): ToolCallWithResult {
	return {
		toolUseId: "tool-1",
		kind: "generic",
		title: name,
		name: name,
		input: input,
		result: "",
		isError: false,
		...overrides,
	};
}

function callWithCanonical(
	name: string,
	input: Record<string, unknown> = {},
	summary?: string,
	formattedInput?: string,
): ToolCallWithResult {
	const overrides: Partial<ToolCallWithResult> = {};
	if (summary !== undefined) {
		overrides.summary = summary;
	}
	if (formattedInput !== undefined) {
		overrides.formattedInput = formattedInput;
	}
	return call(name, input, overrides);
}

function createFrontendPlugin(): FrontendPlugin {
	return {
		id: "test-plugin",
		displayName: "Test Plugin",
		summaryExtractors: {
			["CustomTool"]: (input) => `summary:${String(input["k"] ?? "")}`,
		},
		inputFormatters: {
			["CustomTool"]: (input) => `input:${String(input["k"] ?? "")}`,
		},
	};
}

function makeGetPlugin(plugin: FrontendPlugin): (id: string) => FrontendPlugin | undefined {
	return (id: string): FrontendPlugin | undefined => (id === plugin.id ? plugin : undefined);
}

describe("truncateOutput", () => {
	it("returns output unchanged when under limit", () => {
		expect(truncateOutput("short")).toBe("short");
	});

	it("truncates output at MAX_OUTPUT_LENGTH", () => {
		const long = "x".repeat(MAX_OUTPUT_LENGTH + N_10);
		const truncated = truncateOutput(long);

		expect(truncated.length).toBe(MAX_OUTPUT_LENGTH);
		expect(truncated).toBe(long.slice(0, MAX_OUTPUT_LENGTH));
	});
});

describe("getToolSummary", () => {
	it("prefers call.summary when set", () => {
		const c = callWithCanonical("Read", { ["file_path"]: "/tmp/file.ts" }, "/tmp/file.ts");
		expect(getToolSummary(c)).toBe("/tmp/file.ts");
	});

	it("falls back to plugin summary extractor when call.summary not set", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);

		expect(getToolSummary(call("CustomTool", { k: "v" }), getPlugin, plugin.id)).toBe("summary:v");
	});

	it("falls back to mcp rawName derivation for mcp kind without summary", () => {
		const c = call("mcp__filesystem__read_file", {}, { kind: "mcp", rawName: "mcp__filesystem__read_file" });
		expect(getToolSummary(c)).toBe("read_file");
	});

	it("returns empty string for unknown tool without summary", () => {
		expect(getToolSummary(call("UnknownTool"))).toBe("");
	});

	it("canonical summary takes precedence over plugin extractor", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);
		const c = callWithCanonical("CustomTool", { k: "v" }, "canonical-summary");
		expect(getToolSummary(c, getPlugin, plugin.id)).toBe("canonical-summary");
	});
});

describe("hasInputFormatter", () => {
	it("reports true when call.formattedInput is set", () => {
		const c = callWithCanonical("AnyTool", {}, undefined, "formatted content");
		expect(hasInputFormatter(c)).toBe(true);
	});

	it("reports true for plugin formatter when formattedInput not set", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);

		expect(hasInputFormatter(call("CustomTool"), getPlugin, plugin.id)).toBe(true);
	});

	it("reports false for unknown tools without formattedInput or plugin formatter", () => {
		expect(hasInputFormatter(call("NoFormatter"))).toBe(false);
	});

	it("canonical formattedInput takes precedence over plugin formatter check", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);
		// Even for a tool name the plugin knows, canonical field wins (is true)
		const c = callWithCanonical("CustomTool", { k: "v" }, undefined, "already formatted");
		expect(hasInputFormatter(c, getPlugin, plugin.id)).toBe(true);
	});
});

describe("formatToolInput", () => {
	it("uses call.formattedInput when set", () => {
		const c = callWithCanonical("Edit", { ["file_path"]: "/tmp/a.ts" }, undefined, "canonical format");
		expect(formatToolInput(c)).toBe("canonical format");
	});

	it("uses plugin formatter when formattedInput not set", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);

		expect(formatToolInput(call("CustomTool", { k: "v" }), getPlugin, plugin.id)).toBe("input:v");
	});

	it("falls back to JSON for unknown tools without formattedInput or plugin formatter", () => {
		const text = formatToolInput(call("Unknown", { a: 1 }));
		expect(text).toContain('"a": 1');
	});

	it("canonical formattedInput takes precedence over plugin formatter", () => {
		const plugin = createFrontendPlugin();
		const getPlugin = makeGetPlugin(plugin);
		const c = callWithCanonical("CustomTool", { k: "v" }, undefined, "canonical beats plugin");
		expect(formatToolInput(c, getPlugin, plugin.id)).toBe("canonical beats plugin");
	});

	it("formattedInput with Edit tool uses canonical value end-to-end", () => {
		const editFormatted = "File: /tmp/a.ts\n\nReplace:\nbefore\n\nWith:\nafter";
		const c = callWithCanonical(
			"Edit",
			{
				["file_path"]: "/tmp/a.ts",
				["old_string"]: "before",
				["new_string"]: "after",
			},
			undefined,
			editFormatted,
		);
		const result = formatToolInput(c);
		expect(result).toContain("File: /tmp/a.ts");
		expect(result).toContain("Replace:\nbefore");
		expect(result).toContain("With:\nafter");
	});

	it("falls back to JSON when AskUserQuestion payload has no formattedInput", () => {
		const text = formatToolInput(call("AskUserQuestion", { questions: "bad" }));
		expect(text).toContain('"questions": "bad"');
	});
});
