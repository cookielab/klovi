import { describe, expect, mock, test } from "bun:test";
import { iterateJsonl } from "./jsonl-utils.ts";

describe("iterateJsonl", () => {
  test("skips blank lines and yields parsed records", () => {
    const seen: unknown[] = [];

    iterateJsonl('\n{"name":"one"}\n  \n{"name":"two"}', (ctx) => {
      seen.push({ parsed: ctx.parsed, lineNumber: ctx.lineNumber });
    });

    expect(seen).toEqual([
      { parsed: { name: "one" }, lineNumber: 2 },
      { parsed: { name: "two" }, lineNumber: 4 },
    ]);
  });

  test("limits processing with startAt and maxLines", () => {
    const names: string[] = [];

    iterateJsonl(
      '{"name":"zero"}\n{"name":"one"}\n{"name":"two"}',
      (ctx) => {
        names.push((ctx.parsed as { name: string }).name);
      },
      { startAt: 1, maxLines: 1 },
    );

    expect(names).toEqual(["one"]);
  });

  test("invokes onMalformed with source line and number", () => {
    const malformed = mock((_line: string, _lineNumber: number, _error: unknown) => {});

    iterateJsonl('{"ok":1}\n{broken}', () => {}, { onMalformed: malformed });

    expect(malformed).toHaveBeenCalledTimes(1);
    expect(malformed.mock.calls[0]?.[0]).toBe("{broken}");
    expect(malformed.mock.calls[0]?.[1]).toBe(2);
  });

  test("allows visitor to break early", () => {
    const values: number[] = [];

    iterateJsonl('{"n":1}\n{"n":2}\n{"n":3}', (ctx) => {
      const value = (ctx.parsed as { n: number }).n;
      values.push(value);
      return value < 2;
    });

    expect(values).toEqual([1, 2]);
  });
});
