const XML_CLOSING_TAG_REGEX = /<\/\w+>\s*$/;
const TS_DECLARATION_REGEX = /^(export\s+)?(interface|type)\s+\w+/;
const TS_TYPE_ANNOTATION_REGEX = /:\s*(string|number|boolean|Record|Array)\b/;
const PY_DECLARATION_REGEX = /^(def|class|import|from)\s+\w+/;
const PY_BLOCK_KEYWORD_REGEX = /^\s*(def|class|if|for|while|with|try|except)\s/;
const CSS_SELECTOR_BLOCK_REGEX = /^[@.#:\w[\]-]+\s*\{/m;
const CSS_DECLARATION_REGEX = /:\s*[^;]+;/m;
const CSS_AT_RULE_REGEX = /^@(media|import|keyframes|font-face)\s/;
const YAML_KEY_VALUE_REGEX = /^\s*[\w.-]+:\s/;
const CODE_STRUCTURE_REGEX = /^(export|import|const|let|var|function|class)\s/;

/**
 * Detects the language/format of CLI output for syntax highlighting.
 * Returns a Prism language identifier or null if no format is detected.
 * Only matches when the entire output is a single format (whole-output detection).
 */
export function detectOutputFormat(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  if (isJson(trimmed)) return "json";
  if (isDiff(trimmed)) return "diff";
  if (isXmlOrHtml(trimmed)) return "markup";
  if (isTypeScript(trimmed)) return "typescript";
  if (isPython(trimmed)) return "python";
  if (isCss(trimmed)) return "css";
  if (isYaml(trimmed)) return "yaml";

  return null;
}

function isJson(text: string): boolean {
  const first = text[0];
  const last = text[text.length - 1];
  if (!((first === "{" && last === "}") || (first === "[" && last === "]"))) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function isDiff(text: string): boolean {
  if (text.startsWith("diff ") || text.startsWith("--- ") || text.startsWith("+++ ")) return true;

  const lines = text.split("\n");
  let diffLineCount = 0;
  for (const line of lines) {
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@")) {
      diffLineCount++;
    }
  }
  return diffLineCount >= 3 && diffLineCount / lines.length > 0.3;
}

function isXmlOrHtml(text: string): boolean {
  if (text.startsWith("<?xml") || text.startsWith("<!DOCTYPE") || text.startsWith("<!doctype")) {
    return true;
  }
  // Must start with a tag and contain a closing tag
  if (text.startsWith("<") && XML_CLOSING_TAG_REGEX.test(text)) return true;
  return false;
}

function isTypeScript(text: string): boolean {
  // TypeScript-specific patterns (interface, type alias, type annotations)
  if (TS_DECLARATION_REGEX.test(text)) return true;
  if (TS_TYPE_ANNOTATION_REGEX.test(text) && hasCodeStructure(text)) return true;
  return false;
}

function isPython(text: string): boolean {
  if (PY_DECLARATION_REGEX.test(text)) return true;
  if (text.includes("if __name__")) return true;
  // Multiple lines with Python-style indent and colons
  const lines = text.split("\n");
  const pyLines = lines.filter((l) => PY_BLOCK_KEYWORD_REGEX.test(l));
  return pyLines.length >= 2;
}

function isCss(text: string): boolean {
  // CSS selectors followed by declaration blocks
  if (CSS_SELECTOR_BLOCK_REGEX.test(text) && CSS_DECLARATION_REGEX.test(text)) return true;
  if (CSS_AT_RULE_REGEX.test(text)) return true;
  return false;
}

function isYaml(text: string): boolean {
  if (text.startsWith("---")) return true;
  // Multiple key: value lines, no braces (to avoid JSON false positives)
  if (text.includes("{") || text.includes("[")) return false;
  const lines = text.split("\n");
  const kvLines = lines.filter((l) => YAML_KEY_VALUE_REGEX.test(l));
  return kvLines.length >= 2 && kvLines.length / lines.length > 0.3;
}

function hasCodeStructure(text: string): boolean {
  const lines = text.split("\n");
  return lines.length >= 2 && CODE_STRUCTURE_REGEX.test(text);
}
