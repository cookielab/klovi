import { describe, expect, test } from "bun:test";
import { formatTimestamp } from "./time.ts";

describe("formatTimestamp", () => {
  test("'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatTimestamp(now)).toBe("just now");
  });

  test("'Xm ago' for minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatTimestamp(fiveMinAgo)).toBe("5m ago");
  });

  test("'Xh ago' for hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(formatTimestamp(threeHoursAgo)).toBe("3h ago");
  });

  test("date string for older timestamps", () => {
    const result = formatTimestamp("2024-02-06T14:30:00Z");
    // Should contain month and time
    expect(result).toMatch(/^[A-Z][a-z]+ \d+, \d{2}:\d{2}$/);
  });

  test("empty string for invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("");
  });
});
