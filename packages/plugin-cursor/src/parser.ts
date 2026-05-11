import type {
	AssistantTurn,
	ContentBlock,
	PluginConfig,
	Session,
	SqliteClientTag,
	SystemTurn,
	ToolCallKind,
	ToolCallWithResult,
	Turn,
	UserTurn,
} from "@cookielab.io/klovi-plugin-core";
import { parseMcpDisplayName } from "@cookielab.io/klovi-plugin-core";
import type { FileSystem, Error as PlatformError } from "@effect/platform";
import { Effect } from "effect";
import { openCursorGlobalDb } from "./db";
import { buildCursorProjectIndex } from "./discovery";
import { loadCursorPlanSession } from "./plans";
import { readFileText } from "./shared/discovery-utils";
import { tryParseJson } from "./shared/json-utils";
import { iterateJsonl } from "./shared/jsonl-utils";
import type { CursorAgentSummary, CursorComposerSummary } from "./types";

const COMPOSER_PREFIX_REGEX = /^composer:/u;
const AGENT_PREFIX_REGEX = /^agent:/u;
const PLAN_PREFIX_REGEX = /^plan:/u;

type CursorComposerData = {
	composerId?: string;
	createdAt?: number;
	fullConversationHeadersOnly?: CursorConversationHeader[];
	conversation?: CursorBubblePayload[];
};

type CursorConversationHeader = {
	bubbleId?: string;
};

type CursorBubblePayload = {
	bubbleId?: string;
	type?: number;
	text?: string;
	capabilityType?: number | null;
	thinking?: {
		text?: string;
	};
	toolFormerData?: {
		toolCallId?: string;
		name?: string;
		params?: unknown;
		result?: unknown;
		status?: string;
	};
};

type TranscriptLine = {
	role?: string;
	message?: {
		content?: Array<{
			type?: string;
			text?: string;
		}>;
	};
};

function makeUserTurn(uuid: string, timestamp: string, text: string): UserTurn {
	return {
		kind: "user",
		uuid: uuid,
		timestamp: timestamp,
		text: text,
	};
}

function makeAssistantTurn(uuid: string, timestamp: string, contentBlocks: ContentBlock[]): AssistantTurn {
	return {
		kind: "assistant",
		uuid: uuid,
		timestamp: timestamp,
		model: "unknown",
		contentBlocks: contentBlocks,
	};
}

function makeSystemTurn(uuid: string, timestamp: string, text: string): SystemTurn {
	return {
		kind: "system",
		uuid: uuid,
		timestamp: timestamp,
		text: text,
	};
}

function synthesizedTimestamp(baseTimestampMs: number, index: number): string {
	return new Date(baseTimestampMs + index).toISOString();
}

const N_80 = 80;
const N_60 = 60;

function truncateCursor(s: string, max: number): string {
	return s.length <= max ? s : `${s.slice(0, max)}...`;
}

const FILE_READ_TOOLS = new Set(["read_file", "ReadFile"]);
const FILE_WRITE_TOOLS = new Set(["write_file", "WriteFile"]);
const FILE_EDIT_TOOLS = new Set(["edit_file", "EditFile"]);
const FILE_DIFF_TOOLS = new Set(["apply_diff", "ApplyDiff"]);
const SHELL_TOOLS = new Set(["run_terminal_cmd", "RunTerminalCmd", "bash", "Bash"]);
const WEB_SEARCH_TOOLS = new Set(["web_search", "WebSearch"]);
const WEB_FETCH_TOOLS = new Set(["web_fetch", "fetch_url", "WebFetch"]);

function buildWriteFormattedInput(filePath: string, input: Record<string, unknown>): string {
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

function buildEditFormattedInput(filePath: string, input: Record<string, unknown>): string {
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

type CursorNormalized = {
	kind: ToolCallKind;
	title: string;
	summary?: string | undefined;
	formattedInput?: string | undefined;
};

function normalizeFileToolCall(rawName: string, input: Record<string, unknown>): CursorNormalized | null {
	const filePath = String(input["path"] || input["file_path"] || "");
	const filePathFormatted = filePath ? `File: ${filePath}` : JSON.stringify(input, null, 2);
	if (FILE_READ_TOOLS.has(rawName)) {
		return { kind: "file_read", title: rawName, summary: filePath, formattedInput: filePathFormatted };
	}
	if (FILE_WRITE_TOOLS.has(rawName)) {
		return {
			kind: "file_write",
			title: rawName,
			summary: filePath,
			formattedInput: buildWriteFormattedInput(filePath, input),
		};
	}
	if (FILE_EDIT_TOOLS.has(rawName)) {
		return {
			kind: "file_edit",
			title: rawName,
			summary: filePath,
			formattedInput: buildEditFormattedInput(filePath, input),
		};
	}
	if (FILE_DIFF_TOOLS.has(rawName)) {
		return { kind: "file_edit", title: rawName, summary: filePath, formattedInput: filePathFormatted };
	}
	return null;
}

function normalizeToolCall(rawName: string, input: Record<string, unknown>): CursorNormalized {
	if (rawName.startsWith("mcp__")) {
		return { kind: "mcp", title: parseMcpDisplayName(rawName) };
	}
	const fileResult = normalizeFileToolCall(rawName, input);
	if (fileResult) {
		return fileResult;
	}
	const command = String(input["command"] || input["cmd"] || "");
	if (SHELL_TOOLS.has(rawName)) {
		return {
			kind: "shell",
			title: rawName,
			summary: truncateCursor(command, N_80),
			formattedInput: command || JSON.stringify(input, null, 2),
		};
	}
	if (WEB_SEARCH_TOOLS.has(rawName)) {
		return { kind: "web", title: rawName, summary: truncateCursor(String(input["query"] || ""), N_60) };
	}
	if (WEB_FETCH_TOOLS.has(rawName)) {
		return { kind: "web", title: rawName, summary: truncateCursor(String(input["url"] || ""), N_60) };
	}
	return { kind: "generic", title: rawName };
}

function normalizeToolInput(params: unknown): Record<string, unknown> {
	if (typeof params === "string") {
		const parsed = tryParseJson<unknown>(params);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		if (parsed !== undefined) {
			return { value: parsed };
		}
		return { raw: params };
	}

	if (params && typeof params === "object" && !Array.isArray(params)) {
		return params as Record<string, unknown>;
	}

	if (params === undefined) {
		return {};
	}

	return { value: params };
}

function normalizeToolResult(result: unknown): string {
	if (typeof result === "string") {
		return result;
	}
	if (result === undefined || result === null) {
		return "";
	}
	if (typeof result === "object") {
		try {
			return JSON.stringify(result, null, 2);
		} catch {
			return String(result);
		}
	}
	return String(result);
}

function bubbleToContentBlock(bubble: CursorBubblePayload): ContentBlock | null {
	const tool = bubble.toolFormerData;
	if (tool?.name) {
		const rawName = tool.name;
		const input = normalizeToolInput(tool.params);
		const normalized = normalizeToolCall(rawName, input);
		const call: ToolCallWithResult = {
			toolUseId: tool.toolCallId ?? bubble.bubbleId ?? tool.name,
			kind: normalized.kind,
			title: normalized.title,
			rawName: rawName,
			input: input,
			result: normalizeToolResult(tool.result),
			isError: tool.status !== "completed" && tool.status !== "success",
		};
		if (normalized.summary !== undefined) {
			call.summary = normalized.summary;
		}
		if (normalized.formattedInput !== undefined) {
			call.formattedInput = normalized.formattedInput;
		}
		return { type: "tool_call", call: call };
	}

	const thinkingText = bubble.thinking?.text?.trim();
	if (thinkingText) {
		return { type: "thinking", block: { text: thinkingText } };
	}

	const text = bubble.text?.trim();
	if (text) {
		return { type: "text", text: text };
	}

	return null;
}

function buildTurnsFromBubbles(bubbles: CursorBubblePayload[], baseTimestampMs: number): Turn[] {
	const turns: Turn[] = [];
	let assistantBlocks: ContentBlock[] = [];

	const flushAssistant = (): void => {
		if (assistantBlocks.length === 0) {
			return;
		}

		turns.push(
			makeAssistantTurn(
				`cursor-assistant-${turns.length}`,
				synthesizedTimestamp(baseTimestampMs, turns.length),
				assistantBlocks,
			),
		);
		assistantBlocks = [];
	};

	for (const bubble of bubbles) {
		if (bubble.type === 1) {
			flushAssistant();
			turns.push(
				makeUserTurn(
					bubble.bubbleId ?? `cursor-user-${turns.length}`,
					synthesizedTimestamp(baseTimestampMs, turns.length),
					bubble.text?.trim() ?? "",
				),
			);
			continue;
		}

		const block = bubbleToContentBlock(bubble);
		if (block) {
			assistantBlocks.push(block);
		}
	}

	flushAssistant();
	return turns;
}

function readComposerBubblesFromHeaders(
	rawComposerData: CursorComposerData,
	queryBubble: (bubbleId: string) => CursorBubblePayload | null,
): { bubbles: CursorBubblePayload[]; partial: boolean } {
	const headers = rawComposerData.fullConversationHeadersOnly;
	if (!Array.isArray(headers) || headers.length === 0) {
		return { bubbles: [], partial: false };
	}

	const bubbles: CursorBubblePayload[] = [];
	let partial = false;

	for (const header of headers) {
		if (!header?.bubbleId) {
			partial = true;
			continue;
		}

		const bubble = queryBubble(header.bubbleId);
		if (!bubble) {
			partial = true;
			continue;
		}

		bubbles.push(bubble);
	}

	return { bubbles: bubbles, partial: partial };
}

function partialCursorSessionNotice(timestamp: string): SystemTurn {
	return makeSystemTurn(
		"cursor-partial-session",
		timestamp,
		"**Partial Cursor session**\nKlovi could not reconstruct the full Composer transcript from Cursor state. Showing recovered content only.",
	);
}

function loadCursorComposerSession(
	summary: CursorComposerSummary,
): Effect.Effect<Session, never, FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const globalDb = yield* openCursorGlobalDb();
		const baseTimestampMs = summary.createdAtMs;

		try {
			if (!globalDb) {
				return {
					sessionId: summary.rawSessionId,
					project: summary.projectPath,
					pluginId: "cursor",
					turns: [partialCursorSessionNotice(summary.timestamp)],
				} satisfies Session;
			}

			const rawComposer = globalDb
				.query<{ value: string }>("SELECT value FROM cursorDiskKV WHERE key = ?")
				.get(`composerData:${summary.composerId}`);
			const composerData = rawComposer ? tryParseJson<CursorComposerData>(rawComposer.value) : undefined;
			if (!composerData) {
				return {
					sessionId: summary.rawSessionId,
					project: summary.projectPath,
					pluginId: "cursor",
					turns: [partialCursorSessionNotice(summary.timestamp)],
				} satisfies Session;
			}

			const queryBubble = (bubbleId: string): CursorBubblePayload | null => {
				try {
					const row = globalDb
						.query<{ value: string }>("SELECT value FROM cursorDiskKV WHERE key = ?")
						.get(`bubbleId:${summary.composerId}:${bubbleId}`);
					if (!row) {
						return null;
					}
					return tryParseJson<CursorBubblePayload>(row.value) ?? null;
				} catch {
					return null;
				}
			};

			const fromHeaders = readComposerBubblesFromHeaders(composerData, queryBubble);
			const inlineConversation = Array.isArray(composerData.conversation) ? composerData.conversation : [];
			const recoveredBubbles = fromHeaders.bubbles.length > 0 ? fromHeaders.bubbles : inlineConversation;
			const partial = fromHeaders.partial || (fromHeaders.bubbles.length === 0 && inlineConversation.length === 0);
			const turns = buildTurnsFromBubbles(recoveredBubbles, baseTimestampMs);

			return {
				sessionId: summary.rawSessionId,
				project: summary.projectPath,
				pluginId: "cursor",
				turns: partial ? [partialCursorSessionNotice(summary.timestamp), ...turns] : turns,
			} satisfies Session;
		} finally {
			globalDb?.close();
		}
	});
}

function loadCursorAgentSession(
	summary: CursorAgentSummary,
): Effect.Effect<Session, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const text = yield* readFileText(summary.filePath);
		const turns: Turn[] = [];
		let turnIndex = 0;

		iterateJsonl(
			text,
			({ parsed }) => {
				const line = parsed as TranscriptLine;
				if (!Array.isArray(line.message?.content)) {
					return;
				}

				const textBlocks = line.message.content
					.filter((block) => block?.type === "text" && typeof block.text === "string")
					.map((block) => block.text?.trim() ?? "")
					.filter(Boolean);

				if (textBlocks.length === 0) {
					return;
				}

				const timestamp = synthesizedTimestamp(summary.timestampMs, turnIndex);
				const content = textBlocks.join("\n\n");
				if (line.role === "user") {
					turns.push(makeUserTurn(`cursor-agent-user-${turnIndex}`, timestamp, content));
					turnIndex += 1;
					return;
				}

				if (line.role === "assistant") {
					turns.push(
						makeAssistantTurn(`cursor-agent-assistant-${turnIndex}`, timestamp, [{ type: "text", text: content }]),
					);
					turnIndex += 1;
				}
			},
			{ onMalformed: () => undefined },
		);

		return {
			sessionId: summary.rawSessionId,
			project: summary.projectPath,
			pluginId: "cursor",
			turns: turns,
		} satisfies Session;
	});
}

function loadCursorSession(
	nativeId: string,
	sessionId: string,
): Effect.Effect<Session, PlatformError.PlatformError | Error, PluginConfig | FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const index = yield* buildCursorProjectIndex(nativeId);
		const session =
			index.composersById.get(sessionId.replace(COMPOSER_PREFIX_REGEX, "")) ??
			index.agentsById.get(sessionId.replace(AGENT_PREFIX_REGEX, "")) ??
			index.plansById.get(sessionId.replace(PLAN_PREFIX_REGEX, ""));

		if (!session || session.projectPath !== nativeId) {
			return yield* Effect.fail(new Error(`Cursor session not found: ${sessionId}`));
		}

		if (session.kind === "composer") {
			return yield* loadCursorComposerSession(session);
		}
		if (session.kind === "agent") {
			return yield* loadCursorAgentSession(session);
		}
		return yield* loadCursorPlanSession(session);
	});
}

export { buildTurnsFromBubbles, loadCursorSession };
