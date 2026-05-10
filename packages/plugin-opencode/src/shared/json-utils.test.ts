import { tryParseJson } from "./json-utils";

describe("tryParseJson", () => {
	it("parses valid JSON values", () => {
		expect(tryParseJson<{ id: string }>('{"id":"abc"}')).toEqual({ id: "abc" });
		expect(tryParseJson<string[]>('["a","b"]')).toEqual(["a", "b"]);
	});

	it("returns undefined for malformed payloads", () => {
		expect(tryParseJson("{")).toBeUndefined();
		expect(tryParseJson("session-id: abc")).toBeUndefined();
	});
});
