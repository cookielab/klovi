import { describe, expect, mock, test } from "bun:test";
import { iterateJsonl } from "./jsonl-utils.ts";

describe("iterateJsonl", () => {
  test("visits parsed lines with line metadata", () => {
    const seen: unknown[] = [];

    iterateJsonl('{"a":1}\n\n{"b":2}', (ctx) => {
      seen.push({
        parsed: ctx.parsed,
        line: ctx.line,
        lineIndex: ctx.lineIndex,
        lineNumber: ctx.lineNumber,
      });
    });

    expect(seen).toEqual([
      {
        parsed: { a: 1 },
        line: '{"a":1}',
        lineIndex: 0,
        lineNumber: 1,
      },
      {
        parsed: { b: 2 },
        line: '{"b":2}',
        lineIndex: 2,
        lineNumber: 3,
      },
    ]);
  });

  test("supports startAt and maxLines window", () => {
    const values: unknown[] = [];

    iterateJsonl(
      '{"skip":0}\n{"one":1}\n{"two":2}\n{"three":3}',
      (ctx) => {
        values.push(ctx.parsed);
      },
      { startAt: 1, maxLines: 2 },
    );

    expect(values).toEqual([{ one: 1 }, { two: 2 }]);
  });

  test("clamps negative startAt to zero", () => {
    const values: unknown[] = [];

    iterateJsonl(
      '{"x":1}\n{"y":2}',
      (ctx) => {
        values.push(ctx.parsed);
      },
      { startAt: -5, maxLines: 1 },
    );

    expect(values).toEqual([{ x: 1 }]);
  });

  test("reports malformed lines and continues", () => {
    const malformed = mock((_line: string, _lineNumber: number, _error: unknown) => {});
    const values: unknown[] = [];
    const malformedJsonl = ['{"ok":1}', "{bad}", '{"ok":2}'].join("\n");

    iterateJsonl(
      malformedJsonl,
      (ctx) => {
        values.push(ctx.parsed);
      },
      { onMalformed: malformed },
    );

    expect(values).toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(malformed).toHaveBeenCalledTimes(1);
    expect(malformed.mock.calls[0]?.[0]).toBe("{bad}");
    expect(malformed.mock.calls[0]?.[1]).toBe(2);
  });

  test("stops when visitor returns false", () => {
    const values: unknown[] = [];

    iterateJsonl('{"a":1}\n{"b":2}\n{"c":3}', (ctx) => {
      values.push(ctx.parsed);
      if ((ctx.parsed as { b?: number }).b === 2) return false;
      return true;
    });

    expect(values).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
