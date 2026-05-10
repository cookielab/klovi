import { truncate } from "./text-utils";


const N_10 = 10;
const N_5 = 5;

describe("truncate", () => {
	it("returns original string when shorter than max", () => {
		expect(truncate("hello", N_10)).toBe("hello");
	});

	it("returns original string when equal to max", () => {
		expect(truncate("12345", N_5)).toBe("12345");
	});

	it("truncates and appends ellipsis when longer than max", () => {
		expect(truncate("123456789", N_5)).toBe("12345...");
	});
});
