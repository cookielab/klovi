import { truncate } from "./text-utils";

describe("truncate", () => {
	it("returns original text when within max length", () => {
		expect(truncate("hello", 10)).toBe("hello");
		expect(truncate("hello", 5)).toBe("hello");
	});

	it("truncates and appends ellipsis when text is longer", () => {
		expect(truncate("hello world", 5)).toBe("hello...");
	});

	it("supports zero max length", () => {
		expect(truncate("hello", 0)).toBe("...");
	});
});
