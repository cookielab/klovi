import { truncate } from "./text-utils";

describe("truncate", () => {
	it("returns original string when shorter than max", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	it("returns original string when equal to max", () => {
		expect(truncate("12345", 5)).toBe("12345");
	});

	it("truncates and appends ellipsis when longer than max", () => {
		expect(truncate("123456789", 5)).toBe("12345...");
	});
});
