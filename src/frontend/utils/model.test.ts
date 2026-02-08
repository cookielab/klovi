import { describe, expect, test } from "bun:test";
import { shortModel } from "./model.ts";

describe("shortModel", () => {
  test("returns family with major.minor for versioned model IDs", () => {
    expect(shortModel("claude-opus-4-6")).toBe("Opus 4.6");
    expect(shortModel("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
    expect(shortModel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  test("returns family with major only for date-suffixed model IDs", () => {
    expect(shortModel("claude-opus-4-20250514")).toBe("Opus 4");
  });

  test("returns original string for unknown models", () => {
    expect(shortModel("gpt-4o")).toBe("gpt-4o");
  });

  test("returns empty string for empty input", () => {
    expect(shortModel("")).toBe("");
  });
});
