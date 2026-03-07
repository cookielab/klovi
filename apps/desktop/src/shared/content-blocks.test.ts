import { describe, expect, test } from "bun:test";
import { groupContentBlocks } from "./content-blocks.ts";
import type { ContentBlock } from "./types.ts";

describe("groupContentBlocks", () => {
  test("returns empty array for no blocks", () => {
    expect(groupContentBlocks([])).toEqual([]);
  });

  test("single text block is its own group", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "hello" }];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([{ type: "text", text: "hello" }]);
  });

  test("consecutive non-text blocks are grouped together", () => {
    const blocks: ContentBlock[] = [
      { type: "thinking", block: { text: "hmm" } },
      {
        type: "tool_call",
        call: {
          toolUseId: "t1",
          name: "Bash",
          input: { command: "ls" },
          result: "ok",
          isError: false,
        },
      },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
    expect(groups[0]?.[0]?.type).toBe("thinking");
    expect(groups[0]?.[1]?.type).toBe("tool_call");
  });

  test("text block breaks non-text group", () => {
    const blocks: ContentBlock[] = [
      { type: "thinking", block: { text: "thinking" } },
      { type: "text", text: "response" },
      {
        type: "tool_call",
        call: {
          toolUseId: "t1",
          name: "Read",
          input: { file_path: "/a" },
          result: "data",
          isError: false,
        },
      },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveLength(1); // thinking
    expect(groups[1]).toHaveLength(1); // text
    expect(groups[2]).toHaveLength(1); // tool_call
  });

  test("multiple text blocks each get their own group", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
      { type: "text", text: "third" },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual([{ type: "text", text: "first" }]);
    expect(groups[1]).toEqual([{ type: "text", text: "second" }]);
    expect(groups[2]).toEqual([{ type: "text", text: "third" }]);
  });

  test("mixed sequence: non-text, text, non-text, text", () => {
    const blocks: ContentBlock[] = [
      { type: "thinking", block: { text: "a" } },
      {
        type: "tool_call",
        call: {
          toolUseId: "t1",
          name: "Bash",
          input: {},
          result: "",
          isError: false,
        },
      },
      { type: "text", text: "message 1" },
      { type: "thinking", block: { text: "b" } },
      { type: "text", text: "message 2" },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(4);
    // Group 0: thinking + tool_call
    expect(groups[0]).toHaveLength(2);
    // Group 1: text
    expect(groups[1]).toEqual([{ type: "text", text: "message 1" }]);
    // Group 2: thinking
    expect(groups[2]).toHaveLength(1);
    expect(groups[2]?.[0]?.type).toBe("thinking");
    // Group 3: text
    expect(groups[3]).toEqual([{ type: "text", text: "message 2" }]);
  });

  test("trailing non-text blocks are flushed as final group", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "hello" },
      { type: "thinking", block: { text: "trailing" } },
      {
        type: "tool_call",
        call: {
          toolUseId: "t2",
          name: "Write",
          input: {},
          result: "",
          isError: false,
        },
      },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual([{ type: "text", text: "hello" }]);
    expect(groups[1]).toHaveLength(2);
  });

  test("only non-text blocks produce single group", () => {
    const blocks: ContentBlock[] = [
      { type: "thinking", block: { text: "a" } },
      { type: "thinking", block: { text: "b" } },
      { type: "thinking", block: { text: "c" } },
    ];
    const groups = groupContentBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });
});
