import { truncate } from "./text-utils";


const N_10 = 10;
const N_5 = 5;

describe("truncate", () => {
	it("returns original text when within max length", () => {
		expect(truncate("hello", N_10)).toBe("hello");
		expect(truncate("hello", N_5)).toBe("hello");
	});

	it("truncates and appends ellipsis when text is longer", () => {
		expect(truncate("hello world", N_5)).toBe("hello...");
	});

	it("supports zero max length", () => {
		expect(truncate("hello", 0)).toBe("...");
	});
});
