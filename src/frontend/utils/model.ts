export function isClaudeModel(model: string): boolean {
  return model.startsWith("claude-");
}

export function shortModel(model: string): string {
  // Claude: claude-opus-4-6, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001
  const claudeMatch = model.match(/claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{8,})?$/);
  if (claudeMatch) {
    const family = claudeMatch[1]!.charAt(0).toUpperCase() + claudeMatch[1]!.slice(1);
    const major = claudeMatch[2]!;
    const minor = claudeMatch[3];
    return minor ? `${family} ${major}.${minor}` : `${family} ${major}`;
  }

  // GPT: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
  const gptMatch = model.match(/^(gpt-[\w.-]+?)(?:-\d{4}-\d{2}-\d{2})?$/);
  if (gptMatch) {
    return gptMatch[1]!.replace("gpt-", "GPT-");
  }

  // OpenAI reasoning: o1, o3, o3-mini, o4-mini
  const reasoningMatch = model.match(/^(o\d+(?:-\w+)?)(?:-\d{4}-\d{2}-\d{2})?$/);
  if (reasoningMatch) {
    return reasoningMatch[1]!;
  }

  // Gemini: gemini-2.0-flash, gemini-1.5-pro, gemini-2.5-pro-preview-05-06
  const geminiMatch = model.match(/^gemini-([\d]+\.[\d]+[\w-]*)$/);
  if (geminiMatch) {
    return `Gemini ${geminiMatch[1]!}`;
  }

  // Codex: codex-mini-latest, codex-mini
  const codexMatch = model.match(/^codex-([\w-]+)$/);
  if (codexMatch) {
    return `Codex ${codexMatch[1]!}`;
  }

  return model;
}
