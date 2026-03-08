export interface JsonlLineContext {
  parsed: unknown;
  line: string;
  lineIndex: number;
  lineNumber: number;
}

export interface JsonlIterateOptions {
  startAt?: number;
  maxLines?: number;
  onMalformed?: (line: string, lineNumber: number, error: unknown) => void;
}

export function iterateJsonl(
  text: string,
  visitor: (context: JsonlLineContext) => unknown,
  options: JsonlIterateOptions = {},
): void {
  const lines = text.split("\n");
  const start = Math.max(0, options.startAt ?? 0);
  const end =
    options.maxLines === undefined
      ? lines.length
      : Math.min(lines.length, start + options.maxLines);

  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      const shouldContinue = visitor({
        parsed,
        line,
        lineIndex: i,
        lineNumber: i + 1,
      });
      if (shouldContinue === false) break;
    } catch (error) {
      options.onMalformed?.(line, i + 1, error);
    }
  }
}
