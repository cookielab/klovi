// --- path anchors ---
// This test file lives in packages/ui-components/src/tools/
// ui-components src is one level up.
const TOOLS_DIR = import.meta.dir;
const UI_COMPONENTS_SRC = `${TOOLS_DIR}/..`;

// --- quote helpers ---
// These variables prevent biome's noUnnecessaryTemplateExpression from
// simplifying the needle templates away: a template with at least one
// non-literal interpolation is kept as-is by the rule.
const DQ = '"';
const SQ = "'";

// --- provider-id guard ---
// Needles that must not appear in non-test production source files.
// Using template literals with DQ/SQ variables so the needle strings are
// computed values rather than detectable string literals in this source file.
const PROVIDER_ID_NEEDLES: string[] = [
	`${DQ}claude-code${DQ}`,
	`${SQ}claude-code${SQ}`,
	`${DQ}codex-cli${DQ}`,
	`${SQ}codex-cli${SQ}`,
	`${DQ}cursor${DQ}`,
	`${SQ}cursor${SQ}`,
	`${DQ}opencode${DQ}`,
	`${SQ}opencode${SQ}`,
];

// --- raw tool name guard ---
const RAW_TOOL_NAME_NEEDLES: string[] = [
	`${DQ}Bash${DQ}`,
	`${SQ}Bash${SQ}`,
	`${DQ}Edit${DQ}`,
	`${SQ}Edit${SQ}`,
	`${DQ}Task${DQ}`,
	`${SQ}Task${SQ}`,
	`${DQ}command_execution${DQ}`,
	`${SQ}command_execution${SQ}`,
	`${DQ}file_change${DQ}`,
	`${SQ}file_change${SQ}`,
	`${DQ}web_search${DQ}`,
	`${SQ}web_search${SQ}`,
	`${DQ}Read${DQ}`,
	`${SQ}Read${SQ}`,
	`${DQ}Write${DQ}`,
	`${SQ}Write${SQ}`,
];

// --- helpers ---

type Violation = {
	file: string;
	needle: string;
	lineNumber: number;
};

async function collectSourceFiles(dir: string): Promise<string[]> {
	const tsGlob = new Bun.Glob("**/*.ts");
	const tsxGlob = new Bun.Glob("**/*.tsx");
	const found: string[] = [];

	for await (const rel of tsGlob.scan({ cwd: dir, dot: false })) {
		if (!rel.endsWith(".test.ts")) {
			found.push(`${dir}/${rel}`);
		}
	}
	for await (const rel of tsxGlob.scan({ cwd: dir, dot: false })) {
		if (!rel.endsWith(".test.tsx")) {
			found.push(`${dir}/${rel}`);
		}
	}
	return found;
}

async function scanFileForNeedles(filePath: string, needles: string[]): Promise<Violation[]> {
	const content = await Bun.file(filePath).text();
	const lines = content.split("\n");
	const hits: Violation[] = [];
	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx] ?? "";
		for (const needle of needles) {
			if (line.includes(needle)) {
				hits.push({ file: filePath, needle: needle, lineNumber: lineIdx + 1 });
				break;
			}
		}
	}
	return hits;
}

async function collectViolations(dir: string, needles: string[]): Promise<Violation[]> {
	const files = await collectSourceFiles(dir);
	const perFile = await Promise.all(files.map((f) => scanFileForNeedles(f, needles)));
	return perFile.flat();
}

// --- tests ---

describe("ui-components guardrail: no provider-id branching", () => {
	it("non-test source files do not branch on built-in provider id literals", async () => {
		const violations = await collectViolations(UI_COMPONENTS_SRC, PROVIDER_ID_NEEDLES);
		expect(violations).toEqual([]);
	});
});

describe("ui-components guardrail: no raw tool name branching", () => {
	it("tool-rendering source files do not branch on raw tool name literals", async () => {
		const violations = await collectViolations(TOOLS_DIR, RAW_TOOL_NAME_NEEDLES);
		expect(violations).toEqual([]);
	});
});
