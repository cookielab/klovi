/**
 * Messages from slash commands look like:
 *   <command-message>feature-dev:feature-dev</command-message>
 *   <command-name>/feature-dev:feature-dev</command-name>
 *   <command-args>please create a pr...</command-args>
 */

const COMMAND_ARGS_REGEX = /<command-args>([\s\S]*?)<\/command-args>/u;
const COMMAND_NAME_REGEX = /<command-name>([\s\S]*?)<\/command-name>/u;
const COMMAND_MESSAGE_TAG_REGEX = /<command-message>[\s\S]*?<\/command-message>/gu;
const COMMAND_NAME_TAG_REGEX = /<command-name>[\s\S]*?<\/command-name>/gu;

/** Extract just the user's text (for session list previews). */
export function cleanCommandMessage(text: string): string {
	if (!text.includes("<command-message>")) {
		return text;
	}

	const argsMatch = COMMAND_ARGS_REGEX.exec(text);
	if (argsMatch?.[1]) {
		return argsMatch[1].trim();
	}

	// Fallback: use command name when no args present (e.g. arg-less slash commands)
	const nameMatch = COMMAND_NAME_REGEX.exec(text);
	if (nameMatch?.[1]) {
		return nameMatch[1].trim();
	}

	return text.replace(COMMAND_MESSAGE_TAG_REGEX, "").replace(COMMAND_NAME_TAG_REGEX, "").trim();
}

/** Parse structured command info (for session detail view). */
export function parseCommandMessage(text: string): { name: string; args: string } | null {
	if (!text.includes("<command-message>")) {
		return null;
	}

	const nameMatch = COMMAND_NAME_REGEX.exec(text);
	const argsMatch = COMMAND_ARGS_REGEX.exec(text);

	const name = nameMatch?.[1]?.trim() ?? "";
	const args = argsMatch?.[1]?.trim() ?? "";

	if (!(name || args)) {
		return null;
	}
	return { name: name, args: args };
}
