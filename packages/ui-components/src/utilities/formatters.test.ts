import { describe, expect, test } from "bun:test";
import {
  formatFullDateTime,
  formatRelativeTime,
  formatTime,
  formatTimestamp,
  isClaudeModel,
  shortModel,
} from "./formatters.ts";

const DATE_WITH_TIME_REGEX = /^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}$/;

describe("formatTimestamp", () => {
  test("returns relative output for recent minutes and hours", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();

    expect(formatTimestamp(fiveMinAgo)).toBe("5m ago");
    expect(formatTimestamp(threeHoursAgo)).toBe("3h ago");
  });

  test("returns just now for current and future timestamps", () => {
    expect(formatTimestamp(new Date().toISOString())).toBe("just now");
    expect(formatTimestamp(new Date(Date.now() + 60_000).toISOString())).toBe("just now");
  });

  test("returns formatted date for older timestamps", () => {
    const formatted = formatTimestamp("2024-02-06T14:30:00Z");
    expect(formatted).toMatch(DATE_WITH_TIME_REGEX);
  });

  test("returns empty string for invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  test("handles minute, hour, and day thresholds", () => {
    expect(formatRelativeTime(new Date(Date.now() - 10 * 60_000).toISOString())).toBe("10m ago");
    expect(formatRelativeTime(new Date(Date.now() - 5 * 3_600_000).toISOString())).toBe("5h ago");
    expect(formatRelativeTime(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe("3d ago");
  });

  test("returns localized date for old timestamps", () => {
    const old = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const result = formatRelativeTime(old);
    expect(result).not.toContain("d ago");
    expect(result.length).toBeGreaterThan(0);
  });

  test("invalid timestamps surface as locale invalid date", () => {
    expect(formatRelativeTime("invalid")).toContain("Invalid");
  });
});

describe("formatTime", () => {
  test("returns locale-formatted string", () => {
    expect(formatTime("2024-06-15T14:30:00Z").length).toBeGreaterThan(0);
    expect(formatTime("2024-01-01T00:00:00Z").length).toBeGreaterThan(0);
  });
});

describe("formatFullDateTime", () => {
  test("returns empty string for invalid timestamp", () => {
    expect(formatFullDateTime("not-a-date")).toBe("");
  });

  test("returns full date and time string", () => {
    const result = formatFullDateTime("2024-06-15T14:30:45Z");
    expect(result).toContain("2024");
    expect(result.length).toBeGreaterThan(10);
  });
});

describe("shortModel", () => {
  test("formats Claude families and versions", () => {
    expect(shortModel("claude-opus-4-6")).toBe("Opus 4.6");
    expect(shortModel("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
    expect(shortModel("claude-opus-4-20250514")).toBe("Opus 4");
  });

  test("formats GPT, reasoning, gemini, and codex models", () => {
    expect(shortModel("gpt-4o-mini")).toBe("GPT-4o-mini");
    expect(shortModel("gpt-4o-2024-08-06")).toBe("GPT-4o");
    expect(shortModel("o3-mini")).toBe("o3-mini");
    expect(shortModel("gemini-2.5-pro-preview")).toBe("Gemini 2.5-pro-preview");
    expect(shortModel("codex-mini-latest")).toBe("Codex mini-latest");
  });

  test("returns original value for unknown models", () => {
    expect(shortModel("custom-model")).toBe("custom-model");
  });
});

describe("isClaudeModel", () => {
  test("detects Claude prefixes only", () => {
    expect(isClaudeModel("claude-haiku-4-5-20251001")).toBe(true);
    expect(isClaudeModel("gpt-4o")).toBe(false);
    expect(isClaudeModel("")).toBe(false);
  });
});
