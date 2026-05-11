import type {
	AssistantTurn,
	ContentBlock,
	PluginConfig,
	Session,
	SqliteClientTag,
	SqliteDb,
	TokenUsage,
	ToolCallKind,
	ToolCallWithResult,
	Turn,
	UserTurn,
} from "@cookielab.io/klovi-plugin-core";
import { epochMsToIso, parseMcpDisplayName } from "@cookielab.io/klovi-plugin-core";
import type { FileSystem, Error as PlatformError } from "@effect/platform";
import { Effect } from "effect";
import { openOpenCodeDb } from "./db";
import { tryParseJson } from "./shared/json-utils";

// --- DB row types ---

type MessageRow = {
	id: string;
	["session_id"]: string;
	["time_created"]: number;
	data: string;
};

type PartRow = {
	id: string;
	["message_id"]: string;
	["session_id"]: string;
	["time_created"]: number;
	data: string;
};

// --- Parsed message data ---

type MessageDataUser = {
	role: "user";
	time?: { created?: number };
	agent?: string;
	model?: { ["providerID"]?: string; ["modelID"]?: string };
};

type MessageDataAssistant = {
	role: "assistant";
	time?: { created?: number; completed?: number };
	["modelID"]?: string;
	["providerID"]?: string;
	agent?: string;
	cost?: number;
	tokens?: {
		total?: number;
		input: number;
		output: number;
		reasoning?: number;
		cache?: { read: number; write: number };
	};
	finish?: string;
};

type MessageData = MessageDataUser | MessageDataAssistant;

// --- Parsed part data ---

type PartDataText = {
	type: "text";
	text: string;
	synthetic?: boolean;
	ignored?: boolean;
};

type PartDataReasoning = {
	type: "reasoning";
	text: string;
};

type ToolStateCompleted = {
	status: "completed";
	input: Record<string, unknown>;
	output: string;
	title: string;
	metadata: Record<string, unknown>;
	time: { start: number; end: number };
};

type ToolStateError = {
	status: "error";
	input: Record<string, unknown>;
	error: string;
	time: { start: number; end: number };
};

type ToolStatePending = {
	status: "pending";
	input: Record<string, unknown>;
};

type ToolStateRunning = {
	status: "running";
	input: Record<string, unknown>;
};

type PartDataTool = {
	type: "tool";
	["callID"]: string;
	tool: string;
	state: ToolStateCompleted | ToolStateError | ToolStatePending | ToolStateRunning;
};

type PartDataFile = {
	type: "file";
	mime: string;
	filename?: string;
	url: string;
};

type PartDataSnapshot = {
	type: "snapshot";
	snapshot: string;
};

type PartDataStepFinish = {
	type: "step-finish";
	reason: string;
	cost: number;
	tokens: {
		total?: number;
		input: number;
		output: number;
		reasoning?: number;
		cache?: { read: number; write: number };
	};
};

type PartDataOther = {
	type: "step-start" | "patch" | "agent" | "compaction" | "subtask" | "retry";
};

type PartData =
	| PartDataText
	| PartDataReasoning
	| PartDataTool
	| PartDataFile
	| PartDataSnapshot
	| PartDataStepFinish
	| PartDataOther;

// --- Normalization ---

const N_80 = 80;
const N_60 = 60;

function truncateOpenCode(s: string, max: number): string {
	return s.length <= max ? s : `${s.slice(0, max)}...`;
}

const OC_FILE_READ_TOOLS = new Set(["read_file", "ReadFile"]);
const OC_FILE_WRITE_TOOLS = new Set(["write_file", "WriteFile"]);
const OC_FILE_EDIT_TOOLS = new Set(["edit_file", "EditFile"]);
const OC_FILE_DIFF_TOOLS = new Set(["apply_diff", "ApplyDiff"]);
const OC_SHELL_TOOLS = new Set(["bash", "Bash", "run_command", "RunCommand"]);
const OC_WEB_SEARCH_TOOLS = new Set(["web_search", "WebSearch"]);
const OC_WEB_FETCH_TOOLS = new Set(["web_fetch", "fetch_url", "WebFetch"]);

type OpenCodeNormalized = {
	kind: ToolCallKind;
	title: string;
	summary?: string | undefined;
	formattedInput?: string | undefined;
};

function buildOcWriteFormattedInput(filePath: string, input: Record<string, unknown>): string {
	const parts: string[] = [];
	if (filePath) {
		parts.push(`File: ${filePath}`);
	}
	const contentVal = input["content"] || input["new_content"];
	if (contentVal) {
		parts.push(`Content:\n${String(contentVal)}`);
	}
	return parts.join("\n\n") || JSON.stringify(input, null, 2);
}

function buildOcEditFormattedInput(filePath: string, input: Record<string, unknown>): string {
	const parts: string[] = [];
	if (filePath) {
		parts.push(`File: ${filePath}`);
	}
	if (input["old_string"]) {
		parts.push(`Replace:\n${input["old_string"]}`);
	}
	if (input["new_string"]) {
		parts.push(`With:\n${input["new_string"]}`);
	}
	return parts.join("\n\n") || JSON.stringify(input, null, 2);
}

function normalizeFileOcToolCall(rawName: string, input: Record<string, unknown>): OpenCodeNormalized | null {
	const filePath = String(input["path"] || input["file_path"] || "");
	const filePathFormatted = filePath ? `File: ${filePath}` : JSON.stringify(input, null, 2);
	if (OC_FILE_READ_TOOLS.has(rawName)) {
		return { kind: "file_read", title: rawName, summary: filePath, formattedInput: filePathFormatted };
	}
	if (OC_FILE_WRITE_TOOLS.has(rawName)) {
		return {
			kind: "file_write",
			title: rawName,
			summary: filePath,
			formattedInput: buildOcWriteFormattedInput(filePath, input),
		};
	}
	if (OC_FILE_EDIT_TOOLS.has(rawName)) {
		return {
			kind: "file_edit",
			title: rawName,
			summary: filePath,
			formattedInput: buildOcEditFormattedInput(filePath, input),
		};
	}
	if (OC_FILE_DIFF_TOOLS.has(rawName)) {
		return { kind: "file_edit", title: rawName, summary: filePath, formattedInput: filePathFormatted };
	}
	return null;
}

function normalizeToolCall(rawName: string, input: Record<string, unknown>): OpenCodeNormalized {
	if (rawName.startsWith("mcp__")) {
		return { kind: "mcp", title: parseMcpDisplayName(rawName) };
	}
	const fileResult = normalizeFileOcToolCall(rawName, input);
	if (fileResult) {
		return fileResult;
	}
	const command = String(input["command"] || input["cmd"] || "");
	if (OC_SHELL_TOOLS.has(rawName)) {
		return {
			kind: "shell",
			title: rawName,
			summary: truncateOpenCode(command, N_80),
			formattedInput: command || JSON.stringify(input, null, 2),
		};
	}
	if (OC_WEB_SEARCH_TOOLS.has(rawName)) {
		return { kind: "web", title: rawName, summary: truncateOpenCode(String(input["query"] || ""), N_60) };
	}
	if (OC_WEB_FETCH_TOOLS.has(rawName)) {
		return { kind: "web", title: rawName, summary: truncateOpenCode(String(input["url"] || ""), N_60) };
	}
	return { kind: "generic", title: rawName };
}

// --- Turn building ---

function partToContentBlock(partData: PartData, nextToolUseId: () => string): ContentBlock | null {
	switch (partData.type) {
		case "text": {
			const textPart = partData as PartDataText;
			if (textPart.ignored) {
				return null;
			}
			return { type: "text", text: textPart.text };
		}
		case "reasoning": {
			const reasoningPart = partData as PartDataReasoning;
			return { type: "thinking", block: { text: reasoningPart.text } };
		}
		case "tool": {
			const toolPart = partData as PartDataTool;
			return { type: "tool_call", call: buildToolCall(toolPart, nextToolUseId) };
		}
		default:
			return null;
	}
}

function buildToolCall(toolPart: PartDataTool, nextToolUseId: () => string): ToolCallWithResult {
	const { state } = toolPart;
	const { input } = state;
	const toolId = toolPart.callID || nextToolUseId();
	const rawName = toolPart.tool;
	const normalized = normalizeToolCall(rawName, input);

	function applyNormalized(base: ToolCallWithResult): ToolCallWithResult {
		if (normalized.summary !== undefined) {
			base.summary = normalized.summary;
		}
		if (normalized.formattedInput !== undefined) {
			base.formattedInput = normalized.formattedInput;
		}
		return base;
	}

	switch (state.status) {
		case "completed":
			return applyNormalized({
				toolUseId: toolId,
				kind: normalized.kind,
				title: normalized.title,
				rawName: rawName,
				input: state.input,
				result: state.output,
				isError: false,
			});
		case "error":
			return applyNormalized({
				toolUseId: toolId,
				kind: normalized.kind,
				title: normalized.title,
				rawName: rawName,
				input: state.input,
				result: state.error,
				isError: true,
			});
		case "pending":
		case "running":
			return applyNormalized({
				toolUseId: toolId,
				kind: normalized.kind,
				title: normalized.title,
				rawName: rawName,
				input: state.input,
				result: "[Tool execution was interrupted]",
				isError: true,
			});
		default: {
			const _exhaustive: never = state;
			return _exhaustive;
		}
	}
}

function createUserTurn(text: string, timestamp: string, uuid: string): UserTurn {
	return {
		kind: "user",
		uuid: uuid,
		timestamp: timestamp,
		text: text,
	};
}

function createAssistantTurn(options: {
	model: string;
	timestamp: string;
	uuid: string;
	contentBlocks: ContentBlock[];
	usage?: TokenUsage;
	stopReason?: string;
}): AssistantTurn {
	return {
		kind: "assistant",
		uuid: options.uuid,
		timestamp: options.timestamp,
		model: options.model,
		contentBlocks: options.contentBlocks,
		usage: options.usage,
		stopReason: options.stopReason,
	};
}

// --- Exported helpers for testing ---

type OpenCodeMessage = {
	id: string;
	data: MessageData;
	timeCreated: number;
	parts: PartData[];
};

function collectUserText(parts: PartData[]): string {
	const texts: string[] = [];
	for (const part of parts) {
		if (part.type === "text" && !(part as PartDataText).ignored) {
			texts.push((part as PartDataText).text);
		}
	}
	return texts.join("\n");
}

function collectContentBlocks(parts: PartData[], nextToolUseId: () => string): ContentBlock[] {
	const blocks: ContentBlock[] = [];
	for (const part of parts) {
		const block = partToContentBlock(part, nextToolUseId);
		if (block) {
			blocks.push(block);
		}
	}
	return blocks;
}

function tokensToUsage(tokens: MessageDataAssistant["tokens"]): TokenUsage | undefined {
	if (!tokens) {
		return;
	}
	return {
		inputTokens: tokens.input,
		outputTokens: tokens.output,
		cacheReadTokens: tokens.cache?.read,
		cacheCreationTokens: tokens.cache?.write,
	};
}

function extractStepFinishUsage(parts: PartData[]): TokenUsage | undefined {
	for (const part of parts) {
		if (part.type === "step-finish") {
			const sf = part as PartDataStepFinish;
			return {
				inputTokens: sf.tokens.input,
				outputTokens: sf.tokens.output,
				cacheReadTokens: sf.tokens.cache?.read,
				cacheCreationTokens: sf.tokens.cache?.write,
			};
		}
	}
	return undefined;
}

function buildUserTurn(msg: OpenCodeMessage, timestamp: string): UserTurn {
	return createUserTurn(collectUserText(msg.parts), timestamp, msg.id);
}

function buildAssistantTurnFromMsg(
	msg: OpenCodeMessage,
	timestamp: string,
	nextToolUseId: () => string,
): AssistantTurn {
	const data = msg.data as MessageDataAssistant;
	const model = data.modelID || "unknown";
	const contentBlocks = collectContentBlocks(msg.parts, nextToolUseId);
	const usage = tokensToUsage(data.tokens) ?? extractStepFinishUsage(msg.parts);
	return createAssistantTurn({
		model: model,
		timestamp: timestamp,
		uuid: msg.id,
		contentBlocks: contentBlocks,
		...(usage === undefined ? {} : { usage: usage }),
		...(data.finish === undefined ? {} : { stopReason: data.finish }),
	});
}

function buildOpenCodeTurns(messages: OpenCodeMessage[]): Turn[] {
	let toolUseCounter = 0;
	const nextToolUseId = (): string => {
		toolUseCounter += 1;
		return `opencode-tool-${toolUseCounter}`;
	};

	const turns: Turn[] = [];

	for (const msg of messages) {
		const timestamp = epochMsToIso(msg.timeCreated);
		if (msg.data.role === "user") {
			turns.push(buildUserTurn(msg, timestamp));
		} else if (msg.data.role === "assistant") {
			turns.push(buildAssistantTurnFromMsg(msg, timestamp, nextToolUseId));
		}
	}

	return turns;
}

// --- Session loading ---

function groupPartsByMessage(partRows: PartRow[]): Map<string, PartRow[]> {
	const map = new Map<string, PartRow[]>();
	for (const part of partRows) {
		const existing = map.get(part.message_id);
		if (existing) {
			existing.push(part);
		} else {
			map.set(part.message_id, [part]);
		}
	}
	return map;
}

function parsePartRows(rawParts: PartRow[]): PartData[] {
	const parts: PartData[] = [];
	for (const rawPart of rawParts) {
		const parsedPart = tryParseJson<PartData>(rawPart.data);
		if (parsedPart) {
			parts.push(parsedPart);
		}
	}
	return parts;
}

function buildMessagesFromRows(messageRows: MessageRow[], partsByMessage: Map<string, PartRow[]>): OpenCodeMessage[] {
	const messages: OpenCodeMessage[] = [];
	for (const row of messageRows) {
		const data = tryParseJson<MessageData>(row.data);
		if (data) {
			const rawParts = partsByMessage.get(row.id) ?? [];
			messages.push({
				id: row.id,
				data: data,
				timeCreated: row.time_created,
				parts: parsePartRows(rawParts),
			});
		}
	}
	return messages;
}

function loadSessionFromDb(db: SqliteDb, nativeId: string, sessionId: string): Session {
	const sessionRow = db.query<{ directory: string }>("SELECT directory FROM session WHERE id = ?").get(sessionId);

	const project = sessionRow?.directory || nativeId;

	const messageRows = db
		.query<MessageRow>(
			`SELECT id, session_id, time_created, data
       FROM message WHERE session_id = ? ORDER BY time_created ASC`,
		)
		.all(sessionId);

	if (messageRows.length === 0) {
		return emptySession(project, sessionId);
	}

	const partRows = db
		.query<PartRow>(
			`SELECT id, message_id, session_id, time_created, data
       FROM part WHERE session_id = ? ORDER BY message_id, id ASC`,
		)
		.all(sessionId);

	const partsByMessage = groupPartsByMessage(partRows);
	const messages = buildMessagesFromRows(messageRows, partsByMessage);
	const turns = buildOpenCodeTurns(messages);

	return { sessionId: sessionId, project: project, turns: turns, pluginId: "opencode" };
}

function loadOpenCodeSession(
	nativeId: string,
	sessionId: string,
): Effect.Effect<Session, PlatformError.PlatformError, PluginConfig | FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const db = yield* openOpenCodeDb();
		if (!db) {
			return emptySession(nativeId, sessionId);
		}

		try {
			return loadSessionFromDb(db, nativeId, sessionId);
		} catch {
			return emptySession(nativeId, sessionId);
		} finally {
			db.close();
		}
	});
}

function emptySession(project: string, sessionId: string): Session {
	return {
		sessionId: sessionId,
		project: project,
		turns: [],
		pluginId: "opencode",
	};
}

export type { OpenCodeMessage };
export { buildOpenCodeTurns, loadOpenCodeSession };
