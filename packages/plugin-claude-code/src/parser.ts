import { join } from "node:path";
import type {
	AssistantTurn,
	Attachment,
	ParseErrorTurn,
	Session,
	SessionSummary,
	ToolCallKind,
	ToolCallWithResult,
	ToolResultImage,
	Turn,
	UserTurn,
} from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, streamJsonl } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { parseCommandMessage } from "./command-message";
import type { RawContentBlock, RawLine, RawToolResultBlock } from "./raw-types";

const MAX_RAW_LINE_LENGTH = 500;

type ParsedSession = {
	session: Session;
	slug: string | undefined;
};

function loadClaudeSession(nativeId: string, sessionId: string) {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const filePath = join(config.dataDir, "projects", nativeId, `${sessionId}.jsonl`);
		const { rawLines, parseErrors } = yield* readJsonlLines(filePath);

		const subAgentMap = extractSubAgentMap(rawLines);
		const slug = extractSlug(rawLines);
		const turns = buildTurns(rawLines, parseErrors);

		// Attach subAgentId to Task tool calls and upgrade kind/title
		for (const turn of turns) {
			if (turn.kind !== "assistant") {
				continue;
			}
			for (const block of turn.contentBlocks) {
				if (block.type === "tool_call" && block.call.name === "Task") {
					const agentId = subAgentMap.get(block.call.toolUseId);
					if (agentId) {
						block.call.subAgentId = agentId;
						block.call.kind = "subagent";
						block.call.title = "Sub-Agent";
					}
				}
			}
		}

		return {
			session: {
				sessionId: sessionId,
				project: nativeId,
				turns: turns,
				pluginId: "claude-code",
			},
			slug: slug,
		} as ParsedSession;
	});
}

function parseSubAgentSession(sessionId: string, encodedPath: string, agentId: string) {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const filePath = join(config.dataDir, "projects", encodedPath, sessionId, "subagents", `agent-${agentId}.jsonl`);

		const parsed = yield* readJsonlLines(filePath).pipe(
			Effect.catchAll(() => Effect.succeed({ rawLines: [] as RawLine[], parseErrors: [] as ParseErrorTurn[] })),
		);

		const subAgentMap = extractSubAgentMap(parsed.rawLines);
		const turns = buildTurns(parsed.rawLines, parsed.parseErrors);

		for (const turn of turns) {
			if (turn.kind !== "assistant") {
				continue;
			}
			for (const block of turn.contentBlocks) {
				if (block.type === "tool_call" && block.call.name === "Task") {
					const nestedAgentId = subAgentMap.get(block.call.toolUseId);
					if (nestedAgentId) {
						block.call.subAgentId = nestedAgentId;
						block.call.kind = "subagent";
						block.call.title = "Sub-Agent";
					}
				}
			}
		}

		return { sessionId: sessionId, project: encodedPath, turns: turns, pluginId: "claude-code" } as Session;
	});
}

const AGENT_ID_RE = /agentId:\s*(?<id>\w+)/u;

function extractFromProgressEvent(line: RawLine, map: Map<string, string>): void {
	if (line.type === "progress" && line.parentToolUseID && line.data?.type === "agent_progress" && line.data.agentId) {
		map.set(line.parentToolUseID, line.data.agentId);
	}
}

function extractToolResultText(tr: RawToolResultBlock): string {
	if (typeof tr.content === "string") {
		return tr.content;
	}
	if (Array.isArray(tr.content)) {
		return tr.content
			.filter((c) => c.type === "text" && "text" in c)
			.map((c) => ("text" in c ? c.text : ""))
			.join("");
	}
	return "";
}

function extractFromToolResult(line: RawLine, map: Map<string, string>): void {
	if (line.type !== "user" || !line.message || !Array.isArray(line.message.content)) {
		return;
	}
	for (const block of line.message.content) {
		if (block.type !== "tool_result") {
			continue;
		}
		const tr = block as RawToolResultBlock;
		const match = AGENT_ID_RE.exec(extractToolResultText(tr));
		if (match?.[1]) {
			map.set(tr.tool_use_id, match[1]);
		}
	}
}

function extractSubAgentMap(lines: RawLine[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const line of lines) {
		extractFromProgressEvent(line, map);
		extractFromToolResult(line, map);
	}
	return map;
}

function extractSlug(lines: RawLine[]): string | undefined {
	for (const line of lines) {
		if (line.slug) {
			return line.slug;
		}
	}
	return undefined;
}

const PLAN_PREFIX = "Implement the following plan";

const STATUS_RE = /^\[.+\]$/u;

function findPlanSessionId(
	turns: Turn[],
	slug: string | undefined,
	sessions: SessionSummary[],
	currentSessionId: string,
): string | undefined {
	const planTurn = turns.find((t) => t.kind === "user" && !STATUS_RE.test(t.text.trim())) as UserTurn | undefined;
	if (!planTurn?.text.startsWith(PLAN_PREFIX)) {
		return;
	}
	if (!slug) {
		return;
	}
	const match = sessions.find((s) => s.slug === slug && s.sessionId !== currentSessionId);
	return match?.sessionId;
}

function findImplSessionId(
	slug: string | undefined,
	sessions: SessionSummary[],
	currentSessionId: string,
): string | undefined {
	if (!slug) {
		return;
	}
	const match = sessions.find(
		(s) => s.slug === slug && s.sessionId !== currentSessionId && s.firstMessage.startsWith(PLAN_PREFIX),
	);
	return match?.sessionId;
}

type ParsedLines = {
	rawLines: RawLine[];
	parseErrors: ParseErrorTurn[];
};

function readJsonlLines(filePath: string) {
	return Effect.gen(function* () {
		const rawLines: RawLine[] = [];
		const parseErrors: ParseErrorTurn[] = [];

		yield* streamJsonl(
			filePath,
			({ parsed }) => {
				rawLines.push(parsed as RawLine);
			},
			{
				onMalformed: (line, lineNumber, error) => {
					parseErrors.push({
						kind: "parse_error",
						uuid: `parse-error-line-${lineNumber}`,
						timestamp: rawLines.at(-1)?.timestamp ?? "",
						lineNumber: lineNumber,
						rawLine:
							line.length > MAX_RAW_LINE_LENGTH ? `${line.slice(0, MAX_RAW_LINE_LENGTH)}\u2026 (truncated)` : line,
						errorType: "json_parse",
						errorDetails: error instanceof Error ? error.message : undefined,
					});
				},
			},
		);

		return { rawLines: rawLines, parseErrors: parseErrors } as ParsedLines;
	});
}

function isDisplayableLine(l: RawLine): boolean {
	if (l.type === "progress") {
		return false;
	}
	if (l.type === "file-history-snapshot") {
		return false;
	}
	if (l.type === "summary") {
		return false;
	}
	if (l.isMeta) {
		return false;
	}
	if (!l.message) {
		return false;
	}
	return true;
}

function collectToolResults(
	displayable: RawLine[],
): Map<string, { content: string; isError: boolean; images: ToolResultImage[] }> {
	const toolResults = new Map<string, { content: string; isError: boolean; images: ToolResultImage[] }>();
	for (const line of displayable) {
		if (line.type !== "user" || !line.message) {
			continue;
		}
		const { content } = line.message;
		if (!Array.isArray(content)) {
			continue;
		}
		for (const block of content) {
			if (block.type === "tool_result") {
				const tr = block as RawToolResultBlock;
				const { text, images } = extractToolResult(tr);
				toolResults.set(tr.tool_use_id, {
					content: text,
					isError: tr.is_error ?? false,
					images: images,
				});
			}
		}
	}
	return toolResults;
}

function extractUserContent(content: string | RawContentBlock[]): {
	text: string;
	attachments: Attachment[];
} {
	if (typeof content === "string") {
		return { text: content, attachments: [] };
	}
	const textBlocks = content.filter((b) => b.type === "text");
	const text = textBlocks.map((b) => ("text" in b ? b.text : "")).join("\n");
	const attachments: Attachment[] = [];
	for (const block of content) {
		if (block.type === "image" && "source" in block) {
			attachments.push({
				type: "image",
				mediaType: (block as { source: { ["media_type"]: string } }).source.media_type,
			});
		}
	}
	return { text: text, attachments: attachments };
}

function isSkippedUserText(text: string): boolean {
	return (
		text.startsWith("<local-command") ||
		text.startsWith("<command-name") ||
		text.startsWith("<task-notification") ||
		text.startsWith("<system-reminder")
	);
}

const BASH_INPUT_RE = /<bash-input>(?<input>[\s\S]*?)<\/bash-input>/u;
const BASH_OUTPUT_RE =
	/^<bash-stdout>(?<stdout>[\s\S]*?)<\/bash-stdout>(?:<bash-stderr>(?<stderr>[\s\S]*?)<\/bash-stderr>)?$/u;
const IDE_OPENED_FILE_RE =
	/<ide_opened_file>[\s\S]*?opened the file (?<file>.*?) in the IDE[\s\S]*?<\/ide_opened_file>/u;
function parseSpecialUserContent(
	text: string,
): { bashInput: string } | { bashStdout: string; bashStderr: string | undefined } | { ideOpenedFile: string } | null {
	const bashMatch = BASH_INPUT_RE.exec(text);
	if (bashMatch?.groups?.["input"] !== undefined) {
		return { bashInput: bashMatch.groups["input"] };
	}

	const outputMatch = BASH_OUTPUT_RE.exec(text);
	if (outputMatch?.groups?.["stdout"] !== undefined) {
		return { bashStdout: outputMatch.groups["stdout"], bashStderr: outputMatch.groups?.["stderr"] };
	}

	const ideMatch = IDE_OPENED_FILE_RE.exec(text);
	if (ideMatch?.groups?.["file"] !== undefined) {
		return { ideOpenedFile: ideMatch.groups?.["file"] ?? "" };
	}

	return null;
}

function processUserLine(line: RawLine): UserTurn | "tool_result_only" | null {
	if (!line.message) {
		return null;
	}
	const { content } = line.message;

	if (Array.isArray(content) && content.every((b) => b.type === "tool_result")) {
		return "tool_result_only";
	}

	const { text, attachments } = extractUserContent(content);

	const special = parseSpecialUserContent(text);
	if (special) {
		return {
			kind: "user",
			uuid: line.uuid ?? "",
			timestamp: line.timestamp ?? "",
			text: "",
			...special,
		};
	}

	if (isSkippedUserText(text)) {
		return null;
	}

	const command = parseCommandMessage(text);
	return {
		kind: "user",
		uuid: line.uuid ?? "",
		timestamp: line.timestamp ?? "",
		text: command ? command.args : text,
		command: command ?? undefined,
		attachments: attachments.length > 0 ? attachments : undefined,
	};
}

function createAssistantTurn(line: RawLine): AssistantTurn {
	return {
		kind: "assistant",
		uuid: line.uuid ?? "",
		timestamp: line.timestamp ?? "",
		model: line.message?.model ?? "",
		contentBlocks: [],
	};
}

type ToolResultMap = Map<string, { content: string; isError: boolean; images: ToolResultImage[] }>;

/**
 * Parse a Cursor-style `mcp__<server>__<tool>` raw name into a human-readable
 * label. Returns the tool segment, falling back to the server segment, and
 * ultimately the full raw name if the segments cannot be parsed.
 */
function parseMcpDisplayName(rawName: string): string {
	const parts = rawName.split("__");
	// parts[0] = "mcp", parts[1] = server, parts[2..] = tool segments
	if (parts.length >= 3) {
		return parts.slice(2).join("_");
	}
	if (parts.length === 2 && parts[1]) {
		return parts[1];
	}
	return rawName;
}

function normalizeToolCall(
	rawName: string,
	input: Record<string, unknown>,
	subAgentId?: string | undefined,
): {
	kind: ToolCallKind;
	title: string;
	summary?: string | undefined;
	formattedInput?: string | undefined;
} {
	if (rawName === "Bash") {
		return { kind: "shell", title: "Bash" };
	}
	if (rawName === "Read") {
		return { kind: "file_read", title: "Read" };
	}
	if (rawName === "Write") {
		return { kind: "file_write", title: "Write" };
	}
	if (rawName === "Edit") {
		return { kind: "file_edit", title: "Edit" };
	}
	if (rawName === "NotebookRead") {
		return { kind: "file_read", title: "Notebook Read" };
	}
	if (rawName === "NotebookEdit") {
		return { kind: "file_edit", title: "Notebook Edit" };
	}
	if (rawName === "Glob" || rawName === "Grep") {
		return { kind: "search", title: rawName };
	}
	if (rawName === "WebFetch" || rawName === "WebSearch") {
		return { kind: "web", title: rawName };
	}
	if (rawName === "Skill") {
		const skillName = typeof input["skill_name"] === "string" ? input["skill_name"] : undefined;
		return { kind: "skill", title: skillName ?? "Skill" };
	}
	if (rawName === "Task" && subAgentId !== undefined) {
		return { kind: "subagent", title: "Sub-Agent" };
	}
	if (rawName.startsWith("mcp__")) {
		return { kind: "mcp", title: parseMcpDisplayName(rawName) };
	}
	return { kind: "generic", title: rawName };
}

function buildToolCall(
	block: RawContentBlock,
	toolResults: ToolResultMap,
	subAgentId?: string | undefined,
): ToolCallWithResult {
	const result = toolResults.get((block as { id: string }).id);
	const rawName = (block as { name: string }).name;
	const input = (block as { input: Record<string, unknown> }).input;
	const normalized = normalizeToolCall(rawName, input, subAgentId);
	const toolCall: ToolCallWithResult = {
		toolUseId: (block as { id: string }).id,
		kind: normalized.kind,
		title: normalized.title,
		name: rawName,
		rawName: rawName,
		input: input,
		result: result?.content ?? "",
		isError: result?.isError ?? false,
	};
	if (normalized.summary !== undefined) {
		toolCall.summary = normalized.summary;
	}
	if (normalized.formattedInput !== undefined) {
		toolCall.formattedInput = normalized.formattedInput;
	}
	if (result?.images && result.images.length > 0) {
		toolCall.resultImages = result.images;
	}
	return toolCall;
}

function processContentBlock(block: RawContentBlock, current: AssistantTurn, toolResults: ToolResultMap): void {
	if (block.type === "thinking" && "thinking" in block && block.thinking.trim()) {
		current.contentBlocks.push({ type: "thinking", block: { text: block.thinking } });
	} else if (block.type === "text" && "text" in block && block.text.trim()) {
		current.contentBlocks.push({ type: "text", text: block.text });
	} else if (block.type === "tool_use" && "id" in block) {
		current.contentBlocks.push({ type: "tool_call", call: buildToolCall(block, toolResults) });
	}
}

function processAssistantLine(line: RawLine, current: AssistantTurn, toolResults: ToolResultMap): void {
	const msg = line.message;
	if (!msg) {
		return;
	}
	if (msg.usage) {
		current.usage = {
			inputTokens: msg.usage.input_tokens ?? 0,
			outputTokens: msg.usage.output_tokens ?? 0,
			cacheReadTokens: msg.usage.cache_read_input_tokens,
			cacheCreationTokens: msg.usage.cache_creation_input_tokens,
		};
	}
	if (msg.stop_reason) {
		current.stopReason = msg.stop_reason;
	}
	for (const block of msg.content as RawContentBlock[]) {
		processContentBlock(block, current, toolResults);
	}
}

function flushAssistant(current: AssistantTurn | null, turns: Turn[]): null {
	if (current) {
		turns.push(current);
	}
	return null;
}

function mergeBashTurns(turns: Turn[]): Turn[] {
	const merged: Turn[] = [];
	for (let i = 0; i < turns.length; i++) {
		const turn = turns[i];
		if (!turn) {
			continue;
		}
		const next = turns[i + 1];
		if (
			turn.kind === "user" &&
			turn.bashInput !== undefined &&
			next?.kind === "user" &&
			next.bashStdout !== undefined
		) {
			merged.push({ ...turn, bashStdout: next.bashStdout, bashStderr: next.bashStderr });
			i += 1; // skip merged turn
		} else {
			merged.push(turn);
		}
	}
	return merged;
}

function handleUserLine(line: RawLine, currentAssistant: AssistantTurn | null, turns: Turn[]): AssistantTurn | null {
	const result = processUserLine(line);
	if (result === "tool_result_only") {
		return currentAssistant;
	}
	const flushed = flushAssistant(currentAssistant, turns);
	if (result) {
		turns.push(result);
	}
	return flushed;
}

function handleAssistantLine(
	line: RawLine,
	currentAssistant: AssistantTurn | null,
	toolResults: ToolResultMap,
	structureErrors: ParseErrorTurn[],
): AssistantTurn | null {
	if (!line.message) {
		return currentAssistant;
	}
	if (!Array.isArray(line.message.content)) {
		structureErrors.push({
			kind: "parse_error",
			uuid: `parse-error-${line.uuid ?? "unknown"}`,
			timestamp: line.timestamp ?? "",
			lineNumber: 0,
			rawLine: JSON.stringify(line.message.content).slice(0, MAX_RAW_LINE_LENGTH),
			errorType: "invalid_structure",
			errorDetails: `Assistant message content is ${typeof line.message.content}, expected array`,
		});
		return currentAssistant;
	}
	const current = currentAssistant ?? createAssistantTurn(line);
	processAssistantLine(line, current, toolResults);
	return current;
}

function handleSystemLine(line: RawLine, currentAssistant: AssistantTurn | null, turns: Turn[]): null {
	flushAssistant(currentAssistant, turns);
	if (!line.message) {
		return null;
	}
	const text = typeof line.message.content === "string" ? line.message.content : "";
	turns.push({
		kind: "system",
		uuid: line.uuid ?? "",
		timestamp: line.timestamp ?? "",
		text: text,
	});
	return null;
}

function buildTurns(lines: RawLine[], parseErrors: ParseErrorTurn[] = []): Turn[] {
	const displayable = lines.filter(isDisplayableLine);
	const toolResults = collectToolResults(displayable);

	const turns: Turn[] = [];
	let currentAssistant: AssistantTurn | null = null;
	const structureErrors: ParseErrorTurn[] = [];

	for (const line of displayable) {
		if (line.type === "user") {
			currentAssistant = handleUserLine(line, currentAssistant, turns);
		} else if (line.type === "assistant") {
			currentAssistant = handleAssistantLine(line, currentAssistant, toolResults, structureErrors);
		} else if (line.type === "system") {
			currentAssistant = handleSystemLine(line, currentAssistant, turns);
		}
	}

	flushAssistant(currentAssistant, turns);

	const mergedTurns = mergeBashTurns(turns);

	const allErrors = [...parseErrors, ...structureErrors];
	if (allErrors.length > 0) {
		mergedTurns.push(...allErrors);
	}

	return mergedTurns;
}

function extractToolResult(tr: RawToolResultBlock): {
	text: string;
	images: ToolResultImage[];
} {
	if (typeof tr.content === "string") {
		return { text: tr.content, images: [] };
	}
	if (Array.isArray(tr.content)) {
		const textParts: string[] = [];
		const images: ToolResultImage[] = [];
		for (const c of tr.content) {
			if (c.type === "text" && "text" in c) {
				textParts.push(c.text);
			} else if (c.type === "image" && "source" in c) {
				images.push({
					mediaType: c.source.media_type,
					data: c.source.data,
				});
			}
		}
		return { text: textParts.join("\n"), images: images };
	}
	return { text: "", images: [] };
}

export {
	buildTurns,
	extractSlug,
	extractSubAgentMap,
	findImplSessionId,
	findPlanSessionId,
	loadClaudeSession,
	parseSubAgentSession,
};
