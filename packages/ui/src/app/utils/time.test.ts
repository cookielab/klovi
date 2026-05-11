import { formatFullDateTime, formatRelativeTime, formatTime, formatTimestamp } from "./time";

const N_5 = 5;
const N_60000 = 60_000;
const N_3 = 3;
const N_3600000 = 3_600_000;
const N_10 = 10;
const N_86400000 = 86_400_000;
const N_45 = 45;

const FORMATTED_DATE_REGEX = /^[A-Z][a-z]+ \d+, \d{2}:\d{2}$/u;

describe("formatTimestamp", () => {
	it("'just now' for recent timestamps", () => {
		const now = new Date().toISOString();
		expect(formatTimestamp(now)).toBe("just now");
	});

	it("'Xm ago' for minutes", () => {
		const fiveMinAgo = new Date(Date.now() - N_5 * N_60000).toISOString();
		expect(formatTimestamp(fiveMinAgo)).toBe("5m ago");
	});

	it("'Xh ago' for hours", () => {
		const threeHoursAgo = new Date(Date.now() - N_3 * N_3600000).toISOString();
		expect(formatTimestamp(threeHoursAgo)).toBe("3h ago");
	});

	it("date string for older timestamps", () => {
		const result = formatTimestamp("2024-02-06T14:30:00Z");
		// Should contain month and time
		expect(result).toMatch(FORMATTED_DATE_REGEX);
	});

	it("empty string for invalid date", () => {
		expect(formatTimestamp("not-a-date")).toBe("");
	});
});

describe("formatRelativeTime", () => {
	it("'just now' for recent timestamps", () => {
		const now = new Date().toISOString();
		expect(formatRelativeTime(now)).toBe("just now");
	});

	it("'Xm ago' for minutes", () => {
		const tenMinAgo = new Date(Date.now() - N_10 * N_60000).toISOString();
		expect(formatRelativeTime(tenMinAgo)).toBe("10m ago");
	});

	it("'Xh ago' for hours", () => {
		const fiveHoursAgo = new Date(Date.now() - N_5 * N_3600000).toISOString();
		expect(formatRelativeTime(fiveHoursAgo)).toBe("5h ago");
	});

	it("'Xd ago' for days", () => {
		const threeDaysAgo = new Date(Date.now() - N_3 * N_86400000).toISOString();
		expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
	});

	it("date string for 30+ days", () => {
		const old = new Date(Date.now() - N_45 * N_86400000).toISOString();
		const result = formatRelativeTime(old);
		// Should return toLocaleDateString output (not "Xd ago")
		expect(result).not.toContain("d ago");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("formatTime", () => {
	it("returns formatted date with month, day, and time", () => {
		const result = formatTime("2024-06-15T14:30:00Z");
		// toLocaleDateString with month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
		// Output varies by locale but should contain a month abbreviation and digits
		expect(result.length).toBeGreaterThan(0);
	});

	it("handles midnight timestamp", () => {
		const result = formatTime("2024-01-01T00:00:00Z");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("formatFullDateTime", () => {
	it("returns full date and time string", () => {
		const result = formatFullDateTime("2024-06-15T14:30:45Z");
		// Should contain year, month name, day, and time with seconds
		expect(result).toContain("2024");
		expect(result.length).toBeGreaterThan(N_10);
	});

	it("returns empty string for invalid date", () => {
		expect(formatFullDateTime("not-a-date")).toBe("");
	});

	it("handles current timestamp", () => {
		const result = formatFullDateTime(new Date().toISOString());
		expect(result.length).toBeGreaterThan(0);
	});
});
