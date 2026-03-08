// OpenCode tool summary extractors and input formatters.
// OpenCode uses generic tool names; add specific extractors as patterns are discovered.

export const openCodeSummaryExtractors: Record<string, (input: Record<string, unknown>) => string> =
  {};

export const openCodeInputFormatters: Record<string, (input: Record<string, unknown>) => string> =
  {};
