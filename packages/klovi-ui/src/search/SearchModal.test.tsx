import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { GlobalSessionResult } from "../types/index.ts";
import { SearchModal } from "./SearchModal.tsx";

function makeResult(overrides: Partial<GlobalSessionResult> = {}): GlobalSessionResult {
  return {
    sessionId: "session-1",
    timestamp: "2025-01-01T10:00:00Z",
    slug: "slug",
    firstMessage: "Fix search keyboard navigation",
    model: "claude-sonnet-4-5-20250929",
    gitBranch: "main",
    encodedPath: "-Users-dev-project",
    projectName: "dev/project",
    ...overrides,
  };
}

afterEach(cleanup);

describe("SearchModal (package)", () => {
  test("returns null when closed", () => {
    const { container } = render(
      <SearchModal open={false} sessions={[makeResult()]} onSelect={mock()} onClose={mock()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  test("selects a result when clicked", () => {
    const onSelect = mock();
    const result = makeResult();
    const { getByText } = render(
      <SearchModal open sessions={[result]} onSelect={onSelect} onClose={mock()} />,
    );

    fireEvent.click(getByText("Fix search keyboard navigation"));

    expect(onSelect).toHaveBeenCalledWith(result);
  });

  test("closes on Escape from input", () => {
    const onClose = mock();
    const { getByPlaceholderText } = render(
      <SearchModal open sessions={[makeResult()]} onSelect={mock()} onClose={onClose} />,
    );

    fireEvent.keyDown(getByPlaceholderText("Search sessions..."), { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
