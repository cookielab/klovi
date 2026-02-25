const CLAUDE_MODEL_REGEX = /claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{8,})?$/;
const GPT_MODEL_REGEX = /^(gpt-[\w.-]+?)(?:-\d{4}-\d{2}-\d{2})?$/;
const OPENAI_REASONING_REGEX = /^(o\d+(?:-\w+)?)(?:-\d{4}-\d{2}-\d{2})?$/;
const GEMINI_MODEL_REGEX = /^gemini-([\d]+\.[\d]+[\w-]*)$/;
const CODEX_MODEL_REGEX = /^codex-([\w-]+)$/;

export function isClaudeModel(model: string): boolean {
  return model.startsWith("claude-");
}

export function shortModel(model: string): string {
  // Claude: claude-opus-4-6, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001
  const claudeMatch = model.match(CLAUDE_MODEL_REGEX);
  if (claudeMatch) {
    const rawFamily = claudeMatch[1] ?? "";
    const family = rawFamily.charAt(0).toUpperCase() + rawFamily.slice(1);
    const major = claudeMatch[2] ?? "";
    const minor = claudeMatch[3];
    return minor ? `${family} ${major}.${minor}` : `${family} ${major}`;
  }

  // GPT: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
  const gptMatch = model.match(GPT_MODEL_REGEX);
  if (gptMatch) {
    return gptMatch[1]?.replace("gpt-", "GPT-") ?? model;
  }

  // OpenAI reasoning: o1, o3, o3-mini, o4-mini
  const reasoningMatch = model.match(OPENAI_REASONING_REGEX);
  if (reasoningMatch) {
    return reasoningMatch[1] ?? model;
  }

  // Gemini: gemini-2.0-flash, gemini-1.5-pro, gemini-2.5-pro-preview-05-06
  const geminiMatch = model.match(GEMINI_MODEL_REGEX);
  if (geminiMatch) {
    return `Gemini ${geminiMatch[1] ?? ""}`;
  }

  // Codex: codex-mini-latest, codex-mini
  const codexMatch = model.match(CODEX_MODEL_REGEX);
  if (codexMatch) {
    return `Codex ${codexMatch[1] ?? ""}`;
  }

  return model;
}
