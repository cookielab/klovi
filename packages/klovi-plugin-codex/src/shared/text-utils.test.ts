import { describe, expect, test } from "bun:test";
import { truncate } from "./text-utils.ts";

describe("truncate", () => {
  test("returns original string when shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("returns original string when equal to max", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });

  test("truncates and appends ellipsis when longer than max", () => {
    expect(truncate("123456789", 5)).toBe("12345...");
  });
});
