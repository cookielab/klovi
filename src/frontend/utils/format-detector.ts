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
  if (text.startsWith("<") && /<\/\w+>\s*$/.test(text)) return true;
  return false;
}

function isTypeScript(text: string): boolean {
  // TypeScript-specific patterns (interface, type alias, type annotations)
  if (/^(export\s+)?(interface|type)\s+\w+/.test(text)) return true;
  if (/:\s*(string|number|boolean|Record|Array)\b/.test(text) && hasCodeStructure(text))
    return true;
  return false;
}

function isPython(text: string): boolean {
  if (/^(def|class|import|from)\s+\w+/.test(text)) return true;
  if (text.includes("if __name__")) return true;
  // Multiple lines with Python-style indent and colons
  const lines = text.split("\n");
  const pyLines = lines.filter((l) => /^\s*(def|class|if|for|while|with|try|except)\s/.test(l));
  return pyLines.length >= 2;
}

function isCss(text: string): boolean {
  // CSS selectors followed by declaration blocks
  if (/^[@.#:\w[\]-]+\s*\{/m.test(text) && /:\s*[^;]+;/m.test(text)) return true;
  if (/^@(media|import|keyframes|font-face)\s/.test(text)) return true;
  return false;
}

function isYaml(text: string): boolean {
  if (text.startsWith("---")) return true;
  // Multiple key: value lines, no braces (to avoid JSON false positives)
  if (text.includes("{") || text.includes("[")) return false;
  const lines = text.split("\n");
  const kvLines = lines.filter((l) => /^\s*[\w.-]+:\s/.test(l));
  return kvLines.length >= 2 && kvLines.length / lines.length > 0.3;
}

function hasCodeStructure(text: string): boolean {
  const lines = text.split("\n");
  return lines.length >= 2 && /^(export|import|const|let|var|function|class)\s/.test(text);
}
