import { describe, expect, test } from "bun:test";
import { tryParseJson } from "./json-utils.ts";

describe("tryParseJson", () => {
  test("returns parsed value for valid JSON", () => {
    expect(tryParseJson<{ ok: boolean }>("{\"ok\":true}")).toEqual({ ok: true });
  });

  test("returns undefined for malformed JSON", () => {
    expect(tryParseJson("{not-json}")).toBeUndefined();
  });
});
