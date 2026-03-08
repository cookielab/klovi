/**
 * Messages from slash commands look like:
 *   <command-message>feature-dev:feature-dev</command-message>
 *   <command-name>/feature-dev:feature-dev</command-name>
 *   <command-args>please create a pr...</command-args>
 */

const COMMAND_ARGS_REGEX = /<command-args>([\s\S]*?)<\/command-args>/;
const COMMAND_NAME_REGEX = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_MESSAGE_TAG_REGEX = /<command-message>[\s\S]*?<\/command-message>/g;
const COMMAND_NAME_TAG_REGEX = /<command-name>[\s\S]*?<\/command-name>/g;

/** Extract just the user's text (for session list previews). */
export function cleanCommandMessage(text: string): string {
  if (!text.includes("<command-message>")) return text;

  const argsMatch = text.match(COMMAND_ARGS_REGEX);
  if (argsMatch?.[1]) return argsMatch[1].trim();

  // Fallback: use command name when no args present (e.g. arg-less slash commands)
  const nameMatch = text.match(COMMAND_NAME_REGEX);
  if (nameMatch?.[1]) return nameMatch[1].trim();

  return text.replace(COMMAND_MESSAGE_TAG_REGEX, "").replace(COMMAND_NAME_TAG_REGEX, "").trim();
}

/** Parse structured command info (for session detail view). */
export function parseCommandMessage(text: string): { name: string; args: string } | null {
  if (!text.includes("<command-message>")) return null;

  const nameMatch = text.match(COMMAND_NAME_REGEX);
  const argsMatch = text.match(COMMAND_ARGS_REGEX);

  const name = nameMatch?.[1]?.trim() ?? "";
  const args = argsMatch?.[1]?.trim() ?? "";

  if (!name && !args) return null;
  return { name, args };
}
