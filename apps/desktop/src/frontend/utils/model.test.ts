import { describe, expect, test } from "bun:test";
import { isClaudeModel, shortModel } from "./model.ts";

describe("shortModel", () => {
  test("returns family with major.minor for versioned model IDs", () => {
    expect(shortModel("claude-opus-4-6")).toBe("Opus 4.6");
    expect(shortModel("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5");
    expect(shortModel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  test("returns family with major only for date-suffixed model IDs", () => {
    expect(shortModel("claude-opus-4-20250514")).toBe("Opus 4");
  });

  test("shortens GPT model names", () => {
    expect(shortModel("gpt-4o")).toBe("GPT-4o");
    expect(shortModel("gpt-4o-mini")).toBe("GPT-4o-mini");
    expect(shortModel("gpt-4-turbo")).toBe("GPT-4-turbo");
    expect(shortModel("gpt-3.5-turbo")).toBe("GPT-3.5-turbo");
  });

  test("strips date suffix from GPT models", () => {
    expect(shortModel("gpt-4o-2024-08-06")).toBe("GPT-4o");
    expect(shortModel("gpt-4o-mini-2024-07-18")).toBe("GPT-4o-mini");
  });

  test("shortens OpenAI reasoning models", () => {
    expect(shortModel("o1")).toBe("o1");
    expect(shortModel("o3")).toBe("o3");
    expect(shortModel("o3-mini")).toBe("o3-mini");
    expect(shortModel("o4-mini")).toBe("o4-mini");
  });

  test("shortens Gemini model names", () => {
    expect(shortModel("gemini-2.0-flash")).toBe("Gemini 2.0-flash");
    expect(shortModel("gemini-1.5-pro")).toBe("Gemini 1.5-pro");
    expect(shortModel("gemini-2.5-pro-preview")).toBe("Gemini 2.5-pro-preview");
    expect(shortModel("gemini-2.5-pro-preview-05-06")).toBe("Gemini 2.5-pro-preview-05-06");
  });

  test("shortens Codex model names", () => {
    expect(shortModel("codex-mini-latest")).toBe("Codex mini-latest");
    expect(shortModel("codex-mini")).toBe("Codex mini");
  });

  test("returns original string for unknown models", () => {
    expect(shortModel("unknown-model")).toBe("unknown-model");
  });

  test("returns empty string for empty input", () => {
    expect(shortModel("")).toBe("");
  });
});

describe("isClaudeModel", () => {
  test("returns true for Claude models", () => {
    expect(isClaudeModel("claude-opus-4-6")).toBe(true);
    expect(isClaudeModel("claude-sonnet-4-5-20250929")).toBe(true);
    expect(isClaudeModel("claude-haiku-4-5-20251001")).toBe(true);
  });

  test("returns false for non-Claude models", () => {
    expect(isClaudeModel("gpt-4o")).toBe(false);
    expect(isClaudeModel("gemini-2.0-flash")).toBe(false);
    expect(isClaudeModel("codex-mini")).toBe(false);
    expect(isClaudeModel("o3-mini")).toBe(false);
  });

  test("returns false for empty and unknown strings", () => {
    expect(isClaudeModel("")).toBe(false);
    expect(isClaudeModel("unknown")).toBe(false);
  });
});
