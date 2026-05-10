import { tryParseJson } from "./json-utils";


const N_3 = 3;
const N_42 = 42;

describe("tryParseJson", () => {
	it("parses objects and arrays", () => {
		expect(tryParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
		expect(tryParseJson<number[]>("[1,2,3]")).toEqual([1, 2, N_3]);
	});

	it("parses JSON primitives", () => {
		expect(tryParseJson<number>("42")).toBe(N_42);
		expect(tryParseJson<boolean>("true")).toBe(true);
		expect(tryParseJson<null>("null")).toBeNull();
	});

	it("returns undefined for invalid JSON", () => {
		expect(tryParseJson("not json")).toBeUndefined();
		expect(tryParseJson("{broken")).toBeUndefined();
	});
});
