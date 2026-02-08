import { describe, expect, test } from "bun:test";
import { shortModel } from "./model.ts";

describe("shortModel", () => {
  test("returns Opus for opus model IDs", () => {
    expect(shortModel("claude-opus-4-20250514")).toBe("Opus");
  });

  test("returns Sonnet for sonnet model IDs", () => {
    expect(shortModel("claude-sonnet-4-20250514")).toBe("Sonnet");
  });

  test("returns Haiku for haiku model IDs", () => {
    expect(shortModel("claude-haiku-4-20250514")).toBe("Haiku");
  });

  test("returns original string for unknown models", () => {
    expect(shortModel("gpt-4o")).toBe("gpt-4o");
  });

  test("returns empty string for empty input", () => {
    expect(shortModel("")).toBe("");
  });
});
