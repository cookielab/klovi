import { describe, expect, test } from "bun:test";
import { truncate } from "./text-utils.ts";

describe("truncate", () => {
  test("returns original text when within max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("truncates and appends ellipsis when text is longer", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });

  test("supports zero max length", () => {
    expect(truncate("hello", 0)).toBe("...");
  });
});
