/**
 * Messages from slash commands look like:
 *   <command-message>feature-dev:feature-dev</command-message>
 *   <command-name>/feature-dev:feature-dev</command-name>
 *   <command-args>please create a pr...</command-args>
 */

/** Extract just the user's text (for session list previews). */
export function cleanCommandMessage(text: string): string {
  if (!text.includes("<command-message>")) return text;

  const argsMatch = text.match(
    /<command-args>([\s\S]*?)<\/command-args>/
  );
  if (argsMatch?.[1]) return argsMatch[1].trim();

  return text
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .trim();
}

/** Parse structured command info (for session detail view). */
export function parseCommandMessage(
  text: string
): { name: string; args: string } | null {
  if (!text.includes("<command-message>")) return null;

  const nameMatch = text.match(
    /<command-name>([\s\S]*?)<\/command-name>/
  );
  const argsMatch = text.match(
    /<command-args>([\s\S]*?)<\/command-args>/
  );

  const name = nameMatch?.[1]?.trim() ?? "";
  const args = argsMatch?.[1]?.trim() ?? "";

  if (!name && !args) return null;
  return { name, args };
}
