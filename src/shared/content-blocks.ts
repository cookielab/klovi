import type { ContentBlock } from "./types.ts";

/**
 * Groups content blocks into presentation steps.
 * Each text block is its own step. Consecutive non-text blocks
 * (thinking, tool_call) are grouped into a single step.
 */
export function groupContentBlocks(blocks: ContentBlock[]): ContentBlock[][] {
  const groups: ContentBlock[][] = [];
  let nonTextGroup: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (nonTextGroup.length > 0) {
        groups.push(nonTextGroup);
        nonTextGroup = [];
      }
      groups.push([block]);
    } else {
      nonTextGroup.push(block);
    }
  }
  if (nonTextGroup.length > 0) {
    groups.push(nonTextGroup);
  }
  return groups;
}
