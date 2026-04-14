const XML_CLOSING_TAG_REGEX = /<\/\w+>\s*$/u;
const TS_DECLARATION_REGEX = /^(?:export\s+)?(?:interface|type)\s+\w+/u;
const TS_TYPE_ANNOTATION_REGEX = /:\s*(?:string|number|boolean|Record|Array)\b/u;
const PY_DECLARATION_REGEX = /^(?:def|class|import|from)\s+\w+/u;
const PY_BLOCK_KEYWORD_REGEX = /^\s*(?:def|class|if|for|while|with|try|except)\s/u;
const CSS_SELECTOR_BLOCK_REGEX = /^[@.#:\w[\]-]+\s*\{/mu;
const CSS_DECLARATION_REGEX = /:\s*[^;]+;/mu;
const CSS_AT_RULE_REGEX = /^@(?:media|import|keyframes|font-face)\s/u;
const YAML_KEY_VALUE_REGEX = /^\s*[\w.-]+:\s/u;
const CODE_STRUCTURE_REGEX = /^(?:export|import|const|let|var|function|class)\s/u;

const MIN_DIFF_LINES = 3;
const DIFF_LINE_RATIO = 0.3;
const YAML_LINE_RATIO = 0.3;
const MIN_CODE_LINES = 2;

/**
 * Detects the language/format of CLI output for syntax highlighting.
 * Returns a Prism language identifier or null if no format is detected.
 * Only matches when the entire output is a single format (whole-output detection).
 */
function detectOutputFormat(output: string): string | null {
	const trimmed = output.trim();
	if (!trimmed) {
		return null;
	}

	if (isJson(trimmed)) {
		return "json";
	}
	if (isDiff(trimmed)) {
		return "diff";
	}
	if (isXmlOrHtml(trimmed)) {
		return "markup";
	}
	if (isTypeScript(trimmed)) {
		return "typescript";
	}
	if (isPython(trimmed)) {
		return "python";
	}
	if (isCss(trimmed)) {
		return "css";
	}
	if (isYaml(trimmed)) {
		return "yaml";
	}

	return null;
}

function isJson(text: string): boolean {
	const [first] = text;
	const last = text.at(-1);
	if (!((first === "{" && last === "}") || (first === "[" && last === "]"))) {
		return false;
	}
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

function isDiff(text: string): boolean {
	if (text.startsWith("diff ") || text.startsWith("--- ") || text.startsWith("+++ ")) {
		return true;
	}

	const lines = text.split("\n");
	let diffLineCount = 0;
	for (const line of lines) {
		if (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@")) {
			diffLineCount += 1;
		}
	}
	return diffLineCount >= MIN_DIFF_LINES && diffLineCount / lines.length > DIFF_LINE_RATIO;
}

function isXmlOrHtml(text: string): boolean {
	if (text.startsWith("<?xml") || text.startsWith("<!DOCTYPE") || text.startsWith("<!doctype")) {
		return true;
	}
	// Must start with a tag and contain a closing tag
	if (text.startsWith("<") && XML_CLOSING_TAG_REGEX.test(text)) {
		return true;
	}
	return false;
}

function isTypeScript(text: string): boolean {
	// TypeScript-specific patterns (interface, type alias, type annotations)
	if (TS_DECLARATION_REGEX.test(text)) {
		return true;
	}
	if (TS_TYPE_ANNOTATION_REGEX.test(text) && hasCodeStructure(text)) {
		return true;
	}
	return false;
}

function isPython(text: string): boolean {
	if (PY_DECLARATION_REGEX.test(text)) {
		return true;
	}
	if (text.includes("if __name__")) {
		return true;
	}
	// Multiple lines with Python-style indent and colons
	const lines = text.split("\n");
	const pyLines = lines.filter((l) => PY_BLOCK_KEYWORD_REGEX.test(l));
	return pyLines.length >= MIN_CODE_LINES;
}

function isCss(text: string): boolean {
	// CSS selectors followed by declaration blocks
	if (CSS_SELECTOR_BLOCK_REGEX.test(text) && CSS_DECLARATION_REGEX.test(text)) {
		return true;
	}
	if (CSS_AT_RULE_REGEX.test(text)) {
		return true;
	}
	return false;
}

function isYaml(text: string): boolean {
	if (text.startsWith("---")) {
		return true;
	}
	// Multiple key: value lines, no braces (to avoid JSON false positives)
	if (text.includes("{") || text.includes("[")) {
		return false;
	}
	const lines = text.split("\n");
	const kvLines = lines.filter((l) => YAML_KEY_VALUE_REGEX.test(l));
	return kvLines.length >= MIN_CODE_LINES && kvLines.length / lines.length > YAML_LINE_RATIO;
}

function hasCodeStructure(text: string): boolean {
	const lines = text.split("\n");
	return lines.length >= MIN_CODE_LINES && CODE_STRUCTURE_REGEX.test(text);
}

export { detectOutputFormat };
