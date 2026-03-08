import { describe, expect, test } from "bun:test";
import { tryParseJson } from "./json-utils.ts";

describe("tryParseJson", () => {
  test("parses valid JSON values", () => {
    expect(tryParseJson<{ id: string }>('{"id":"abc"}')).toEqual({ id: "abc" });
    expect(tryParseJson<string[]>('["a","b"]')).toEqual(["a", "b"]);
  });

  test("returns undefined for malformed payloads", () => {
    expect(tryParseJson("{")).toBeUndefined();
    expect(tryParseJson("session-id: abc")).toBeUndefined();
  });
});
