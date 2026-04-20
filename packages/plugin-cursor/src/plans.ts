import { basename } from "node:path";
import type { Session, SystemTurn } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { readFileText } from "./shared/discovery-utils.ts";
import type { CursorPlanSummary } from "./types.ts";

const LEADING_NEWLINES_REGEX = /^\n+/u;
const PLAN_FILE_SUFFIX_REGEX = /\.plan\.md$/u;

type ParsedFrontmatter = {
	body: string;
	name: string;
};

function parseFrontmatterValue(rawValue: string): string {
	const trimmed = rawValue.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parsePlanFrontmatter(text: string): ParsedFrontmatter {
	if (!text.startsWith("---\n")) {
		return { body: text, name: "" };
	}

	const lines = text.split("\n");
	const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (endIndex === -1) {
		return { body: text, name: "" };
	}

	let name = "";
	for (let i = 1; i < endIndex; i++) {
		const line = lines[i]?.trim() ?? "";
		if (!line || line.startsWith("#")) {
			continue;
		}
		const separator = line.indexOf(":");
		if (separator === -1) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		const value = parseFrontmatterValue(line.slice(separator + 1));
		if (key === "name") {
			name = value;
		}
	}

	return {
		body: lines
			.slice(endIndex + 1)
			.join("\n")
			.replace(LEADING_NEWLINES_REGEX, ""),
		name: name,
	};
}

function extractFirstHeading(text: string): string {
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("# ")) {
			return trimmed.slice(2).trim();
		}
	}
	return "";
}

function getPlanFallbackName(filePath: string): string {
	return basename(filePath).replace(PLAN_FILE_SUFFIX_REGEX, "");
}

function readPlanDisplayName(filePath: string) {
	return readFileText(filePath).pipe(
		Effect.map((text) => {
			const parsed = parsePlanFrontmatter(text);
			return parsed.name || extractFirstHeading(parsed.body) || getPlanFallbackName(filePath);
		}),
	);
}

function makeSystemTurn(text: string, timestamp: string): SystemTurn {
	return {
		kind: "system",
		uuid: "cursor-plan",
		timestamp: timestamp,
		text: text,
	};
}

function loadCursorPlanSession(plan: CursorPlanSummary) {
	return readFileText(plan.filePath).pipe(
		Effect.map((text) => {
			const parsed = parsePlanFrontmatter(text);
			return {
				sessionId: plan.rawSessionId,
				project: plan.projectPath,
				pluginId: "cursor",
				turns: [makeSystemTurn(parsed.body, plan.timestamp)],
			} satisfies Session;
		}),
	);
}

export { extractFirstHeading, loadCursorPlanSession, parsePlanFrontmatter, readPlanDisplayName };
