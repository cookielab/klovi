import { type ContentBlock, groupContentBlocks } from "./index";

function text(value: string): ContentBlock {
	return { type: "text", text: value };
}

function thinking(textValue = "thinking"): ContentBlock {
	return { type: "thinking", block: { text: textValue } };
}

function tool(id: string): ContentBlock {
	return {
		type: "tool_call",
		call: {
			toolUseId: id,
			name: "Read",
			input: {},
			result: "ok",
			isError: false,
		},
	};
}

describe("groupContentBlocks", () => {
	it("returns empty array for no blocks", () => {
		expect(groupContentBlocks([])).toEqual([]);
	});

	it("places each text block in its own group", () => {
		const first = text("a");
		const second = text("b");
		const blocks = [first, second];

		expect(groupContentBlocks(blocks)).toEqual([[first], [second]]);
	});

	it("groups consecutive non-text blocks together", () => {
		const first = thinking("t1");
		const second = tool("1");
		const third = tool("2");
		const blocks = [first, second, third];

		expect(groupContentBlocks(blocks)).toEqual([[first, second, third]]);
	});

	it("splits non-text groups around text blocks", () => {
		const first = thinking("t1");
		const second = tool("1");
		const third = text("answer");
		const fourth = tool("2");
		const fifth = thinking("t2");
		const blocks = [first, second, third, fourth, fifth];

		expect(groupContentBlocks(blocks)).toEqual([[first, second], [third], [fourth, fifth]]);
	});

	it("flushes trailing non-text group", () => {
		const first = text("intro");
		const second = tool("1");
		const third = thinking("later");
		const blocks = [first, second, third];

		expect(groupContentBlocks(blocks)).toEqual([[first], [second, third]]);
	});
});
