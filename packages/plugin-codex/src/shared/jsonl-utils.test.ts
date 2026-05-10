import { iterateJsonl } from "./jsonl-utils";



const noop = (): undefined => undefined;
const N_4 = 4;

describe("iterateJsonl", () => {
	it("skips blank lines and yields parsed records", () => {
		const seen: unknown[] = [];

		iterateJsonl('\n{"name":"one"}\n  \n{"name":"two"}', (ctx) => {
			seen.push({ parsed: ctx.parsed, lineNumber: ctx.lineNumber });
		});

		expect(seen).toEqual([
			{ parsed: { name: "one" }, lineNumber: 2 },
			{ parsed: { name: "two" }, lineNumber: N_4 },
		]);
	});

	it("limits processing with startAt and maxLines", () => {
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

	it("invokes onMalformed with source line and number", () => {
		const malformed = mock((_line: string, _lineNumber: number, _error: unknown) => undefined);

		iterateJsonl('{"ok":1}\n{broken}', noop, { onMalformed: malformed });

		expect(malformed).toHaveBeenCalledTimes(1);
		expect(malformed.mock.calls[0]?.[0]).toBe("{broken}");
		expect(malformed.mock.calls[0]?.[1]).toBe(2);
	});

	it("allows visitor to break early", () => {
		const values: number[] = [];

		iterateJsonl('{"n":1}\n{"n":2}\n{"n":3}', (ctx) => {
			const value = (ctx.parsed as { n: number }).n;
			values.push(value);
			return value < 2;
		});

		expect(values).toEqual([1, 2]);
	});
});
