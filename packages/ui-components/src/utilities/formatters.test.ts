import {
	formatFullDateTime,
	formatRelativeTime,
	formatTime,
	formatTimestamp,
	isClaudeModel,
	shortModel,
} from "./formatters";

const N_5 = 5;
const N_60000 = 60_000;
const N_3 = 3;
const N_3600000 = 3_600_000;
const N_10 = 10;
const N_86400000 = 86_400_000;
const N_45 = 45;

const DATE_WITH_TIME_REGEX = /^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}$/u;

describe("formatTimestamp", () => {
	it("returns relative output for recent minutes and hours", () => {
		const fiveMinAgo = new Date(Date.now() - N_5 * N_60000).toISOString();
		const threeHoursAgo = new Date(Date.now() - N_3 * N_3600000).toISOString();

		expect(formatTimestamp(fiveMinAgo)).toBe("5m ago");
		expect(formatTimestamp(threeHoursAgo)).toBe("3h ago");
	});

	it("returns just now for current and future timestamps", () => {
		expect(formatTimestamp(new Date().toISOString())).toBe("just now");
		expect(formatTimestamp(new Date(Date.now() + N_60000).toISOString())).toBe("just now");
	});

	it("returns formatted date for older timestamps", () => {
		const formatted = formatTimestamp("2024-02-06T14:30:00Z");
		expect(formatted).toMatch(DATE_WITH_TIME_REGEX);
	});

	it("returns empty string for invalid date", () => {
		expect(formatTimestamp("not-a-date")).toBe("");
	});
});

describe("formatRelativeTime", () => {
	it("handles minute, hour, and day thresholds", () => {
		expect(formatRelativeTime(new Date(Date.now() - N_10 * N_60000).toISOString())).toBe("10m ago");
		expect(formatRelativeTime(new Date(Date.now() - N_5 * N_3600000).toISOString())).toBe("5h ago");
		expect(formatRelativeTime(new Date(Date.now() - N_3 * N_86400000).toISOString())).toBe("3d ago");
	});

	it("returns localized date for old timestamps", () => {
		const old = new Date(Date.now() - N_45 * N_86400000).toISOString();
		const result = formatRelativeTime(old);
		expect(result).not.toContain("d ago");
		expect(result.length).toBeGreaterThan(0);
	});

	it("invalid timestamps surface as locale invalid date", () => {
		expect(formatRelativeTime("invalid")).toContain("Invalid");
	});
});

describe("formatTime", () => {
	it("returns locale-formatted string", () => {
		expect(formatTime("2024-06-15T14:30:00Z").length).toBeGreaterThan(0);
		expect(formatTime("2024-01-01T00:00:00Z").length).toBeGreaterThan(0);
	});
});

describe("formatFullDateTime", () => {
	it("returns empty string for invalid timestamp", () => {
		expect(formatFullDateTime("not-a-date")).toBe("");
	});

	it("returns full date and time string", () => {
		const result = formatFullDateTime("2024-06-15T14:30:45Z");
		expect(result).toContain("2024");
		expect(result.length).toBeGreaterThan(N_10);
	});
});

describe("shortModel", () => {
	it("formats Claude families and versions", () => {
		expect(shortModel("claude-opus-4-6")).toBe("Opus 4.6");
		expect(shortModel("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
		expect(shortModel("claude-opus-4-20250514")).toBe("Opus 4");
	});

	it("formats GPT, reasoning, gemini, and codex models", () => {
		expect(shortModel("gpt-4o-mini")).toBe("GPT-4o-mini");
		expect(shortModel("gpt-4o-2024-08-06")).toBe("GPT-4o");
		expect(shortModel("o3-mini")).toBe("o3-mini");
		expect(shortModel("gemini-2.5-pro-preview")).toBe("Gemini 2.5-pro-preview");
		expect(shortModel("codex-mini-latest")).toBe("Codex mini-latest");
	});

	it("returns original value for unknown models", () => {
		expect(shortModel("custom-model")).toBe("custom-model");
	});
});

describe("isClaudeModel", () => {
	it("detects Claude prefixes only", () => {
		expect(isClaudeModel("claude-haiku-4-5-20251001")).toBe(true);
		expect(isClaudeModel("gpt-4o")).toBe(false);
		expect(isClaudeModel("")).toBe(false);
	});
});
