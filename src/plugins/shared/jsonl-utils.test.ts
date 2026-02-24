import { describe, expect, test } from "bun:test";
import { iterateJsonl } from "./jsonl-utils.ts";

describe("iterateJsonl", () => {
  test("iterates parsed non-empty lines in order", () => {
    const seen: number[] = [];
    const text = ['{"n":1}', "", "  ", '{"n":2}'].join("\n");

    iterateJsonl(text, ({ parsed }) => {
      seen.push((parsed as { n: number }).n);
    });

    expect(seen).toEqual([1, 2]);
  });

  test("supports startAt and maxLines", () => {
    const seen: number[] = [];
    const text = ['{"n":1}', '{"n":2}', '{"n":3}', '{"n":4}'].join("\n");

    iterateJsonl(
      text,
      ({ parsed }) => {
        seen.push((parsed as { n: number }).n);
      },
      { startAt: 1, maxLines: 2 },
    );

    expect(seen).toEqual([2, 3]);
  });

  test("supports early exit when visitor returns false", () => {
    const seen: number[] = [];
    const text = ['{"n":1}', '{"n":2}', '{"n":3}'].join("\n");

    iterateJsonl(text, ({ parsed }) => {
      seen.push((parsed as { n: number }).n);
      if (seen.length === 2) return false;
    });

    expect(seen).toEqual([1, 2]);
  });

  test("invokes onMalformed for invalid json lines", () => {
    const malformed: number[] = [];
    const seen: number[] = [];
    const text = ['{"n":1}', "{bad}", '{"n":2}'].join("\n");

    iterateJsonl(
      text,
      ({ parsed }) => {
        seen.push((parsed as { n: number }).n);
      },
      {
        onMalformed: (_line, lineNumber) => {
          malformed.push(lineNumber);
        },
      },
    );

    expect(seen).toEqual([1, 2]);
    expect(malformed).toEqual([2]);
  });
});
