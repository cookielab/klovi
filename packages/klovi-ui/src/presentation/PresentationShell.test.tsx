import { afterEach, describe, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Turn } from "../types/index.ts";
import { PresentationShell } from "./PresentationShell.tsx";

const STEP_REGEX = /Step\s+1\s*\/\s*2/;

function makeTurns(): Turn[] {
  return [
    {
      kind: "user",
      uuid: "u1",
      timestamp: "2025-01-01T10:00:00Z",
      text: "Hello",
    },
    {
      kind: "assistant",
      uuid: "a1",
      timestamp: "2025-01-01T10:00:01Z",
      model: "claude-opus-4-6",
      contentBlocks: [{ type: "text", text: "Hi there" }],
    },
  ];
}

afterEach(cleanup);

describe("PresentationShell (package)", () => {
  test("renders progress information", async () => {
    const { findByText } = render(<PresentationShell turns={makeTurns()} onExit={() => {}} />);

    await findByText(STEP_REGEX);
    await findByText("← → step · ↑ ↓ message · Esc exit · F fullscreen");
  });
});
