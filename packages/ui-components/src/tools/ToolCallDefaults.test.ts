import type { ToolCallWithResult } from "../types/index";
import {
	formatToolInput,
	getToolSummary,
	hasInputFormatter,
	MAX_OUTPUT_LENGTH,
	truncateOutput,
} from "./ToolCallDefaults";

const N_10 = 10;

function call(
	name: string,
	input: Record<string, unknown> = {},
	overrides: Partial<ToolCallWithResult> = {},
): ToolCallWithResult {
	return {
		toolUseId: "tool-1",
		kind: "generic",
		title: name,
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

	it("falls back to mcp rawName derivation for mcp kind without summary", () => {
		const c = call("mcp__filesystem__read_file", {}, { kind: "mcp", rawName: "mcp__filesystem__read_file" });
		expect(getToolSummary(c)).toBe("read_file");
	});

	it("returns empty string for unknown tool without summary", () => {
		expect(getToolSummary(call("UnknownTool"))).toBe("");
	});
});

describe("hasInputFormatter", () => {
	it("reports true when call.formattedInput is set", () => {
		const c = callWithCanonical("AnyTool", {}, undefined, "formatted content");
		expect(hasInputFormatter(c)).toBe(true);
	});

	it("reports false for unknown tools without formattedInput", () => {
		expect(hasInputFormatter(call("NoFormatter"))).toBe(false);
	});
});

describe("formatToolInput", () => {
	it("uses call.formattedInput when set", () => {
		const c = callWithCanonical("Edit", { ["file_path"]: "/tmp/a.ts" }, undefined, "canonical format");
		expect(formatToolInput(c)).toBe("canonical format");
	});

	it("falls back to JSON for unknown tools without formattedInput", () => {
		const text = formatToolInput(call("Unknown", { a: 1 }));
		expect(text).toContain('"a": 1');
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
