import { describe, expect, test } from "bun:test";
import { tryParseJson } from "./json-utils.ts";

describe("tryParseJson", () => {
  test("parses objects and arrays", () => {
    expect(tryParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("parses JSON primitives", () => {
    expect(tryParseJson<number>("42")).toBe(42);
    expect(tryParseJson<boolean>("true")).toBe(true);
    expect(tryParseJson<null>("null")).toBeNull();
  });

  test("returns undefined for invalid JSON", () => {
    expect(tryParseJson("not json")).toBeUndefined();
    expect(tryParseJson("{broken")).toBeUndefined();
  });
});
