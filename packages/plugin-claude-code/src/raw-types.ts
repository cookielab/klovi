type RawLine = {
	type: string;
	parentUuid?: string | null;
	uuid?: string;
	isSidechain?: boolean;
	isMeta?: boolean;
	cwd?: string;
	sessionId?: string;
	version?: string;
	gitBranch?: string;
	slug?: string;
	timestamp?: string;
	message?: RawMessage;
	parentToolUseID?: string;
	data?: { type?: string; agentId?: string; [key: string]: unknown };
};

type RawMessage = {
	role: "user" | "assistant";
	model?: string;
	content: string | RawContentBlock[];
	["stop_reason"]?: string;
	usage?: {
		["input_tokens"]?: number;
		["output_tokens"]?: number;
		["cache_read_input_tokens"]?: number;
		["cache_creation_input_tokens"]?: number;
	};
};

type RawContentBlock = RawTextBlock | RawThinkingBlock | RawToolUseBlock | RawToolResultBlock | RawImageBlock;

type RawTextBlock = {
	type: "text";
	text: string;
};

type RawThinkingBlock = {
	type: "thinking";
	thinking: string;
};

type RawToolUseBlock = {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
};

type RawToolResultBlock = {
	type: "tool_result";
	["tool_use_id"]: string;
	content: string | RawToolResultContent[];
	["is_error"]?: boolean;
};

type RawImageBlock = {
	type: "image";
	source: {
		type: "base64";
		["media_type"]: string;
		data: string;
	};
};

type RawToolResultContent = RawToolResultTextContent | RawToolResultImageContent;

type RawToolResultTextContent = {
	type: "text";
	text: string;
};

type RawToolResultImageContent = {
	type: "image";
	source: {
		type: "base64";
		["media_type"]: string;
		data: string;
	};
};

export type { RawContentBlock, RawLine, RawToolResultBlock };
