import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Turn } from "../../../shared/types.ts";
import { PresentationShell } from "./PresentationShell.tsx";

afterEach(cleanup);

function makeTurns(): Turn[] {
  return [
    {
      kind: "user",
      uuid: "u1",
      timestamp: "2025-01-15T10:00:00Z",
      text: "Hello",
    },
    {
      kind: "assistant",
      uuid: "a1",
      timestamp: "2025-01-15T10:00:01Z",
      model: "claude-opus-4-6",
      contentBlocks: [
        { type: "text", text: "First response" },
        { type: "text", text: "Second response" },
      ],
    },
    {
      kind: "user",
      uuid: "u2",
      timestamp: "2025-01-15T10:01:00Z",
      text: "Follow up",
    },
    {
      kind: "assistant",
      uuid: "a2",
      timestamp: "2025-01-15T10:01:01Z",
      model: "claude-opus-4-6",
      contentBlocks: [{ type: "text", text: "Another response" }],
    },
  ];
}

describe("PresentationShell", () => {
  test("renders presentation mode container", () => {
    const { container } = render(
      <PresentationShell turns={makeTurns()} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    expect(container.querySelector(".presentation-mode")).not.toBeNull();
  });

  test("shows step counter", () => {
    const { container } = render(
      <PresentationShell turns={makeTurns()} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    expect(container.querySelector(".presentation-progress")?.textContent).toContain("Step");
  });

  test("shows progress bar", () => {
    const { container } = render(
      <PresentationShell turns={makeTurns()} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    expect(container.querySelector(".presentation-progress-bar")).not.toBeNull();
    expect(container.querySelector(".presentation-progress-fill")).not.toBeNull();
  });

  test("shows keyboard shortcut hints", () => {
    const { container } = render(
      <PresentationShell turns={makeTurns()} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    const progressText = container.querySelector(".presentation-progress")?.textContent;
    expect(progressText).toContain("Esc exit");
    expect(progressText).toContain("fullscreen");
  });

  test("renders MessageList with visible turns", () => {
    const { container } = render(
      <PresentationShell turns={makeTurns()} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    // First step should show at least the first turn
    expect(container.querySelector(".message-user")).not.toBeNull();
  });

  test("handles empty turns array", () => {
    const { container } = render(
      <PresentationShell turns={[]} onExit={() => {}} sessionId="s1" project="proj1" />,
    );
    expect(container.querySelector(".presentation-mode")).not.toBeNull();
  });
});
