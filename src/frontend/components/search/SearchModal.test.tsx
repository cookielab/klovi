import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import type { GlobalSessionResult } from "../../../shared/types.ts";
import { SearchModal } from "./SearchModal.tsx";

function makeResult(overrides: Partial<GlobalSessionResult> = {}): GlobalSessionResult {
  return {
    sessionId: "abc-123",
    timestamp: "2025-01-15T10:00:00Z",
    slug: "test-slug",
    firstMessage: "Search test message",
    model: "claude-sonnet-4-5-20250929",
    gitBranch: "main",
    encodedPath: "-Users-dev-project",
    projectName: "dev/project",
    ...overrides,
  };
}

describe("SearchModal", () => {
  test("renders input field and results list", () => {
    const sessions = [makeResult({ sessionId: "s1" })];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    expect(modal.getByPlaceholderText("Search sessions...")).toBeTruthy();
    expect(modal.getByText("Search test message")).toBeTruthy();
  });

  test("filters results by query matching firstMessage", () => {
    const sessions = [
      makeResult({ sessionId: "s1", firstMessage: "Fix login bug" }),
      makeResult({ sessionId: "s2", firstMessage: "Add dark mode" }),
    ];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.change(modal.getByPlaceholderText("Search sessions..."), {
      target: { value: "login" },
    });

    expect(modal.getByText("Fix login bug")).toBeTruthy();
    expect(modal.queryByText("Add dark mode")).toBeNull();
  });

  test("filters case-insensitively on projectName", () => {
    const sessions = [
      makeResult({ sessionId: "s1", projectName: "Cookielab/Klovi" }),
      makeResult({ sessionId: "s2", projectName: "other/project" }),
    ];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.change(modal.getByPlaceholderText("Search sessions..."), {
      target: { value: "klovi" },
    });

    expect(modal.getAllByText(/Cookielab\/Klovi/)).toHaveLength(1);
    expect(modal.queryByText(/other\/project/)).toBeNull();
  });

  test("filters by gitBranch", () => {
    const sessions = [
      makeResult({ sessionId: "s1", gitBranch: "feature/search" }),
      makeResult({ sessionId: "s2", gitBranch: "main" }),
    ];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.change(modal.getByPlaceholderText("Search sessions..."), {
      target: { value: "feature/search" },
    });

    expect(modal.getByText(/feature\/search/)).toBeTruthy();
    const items = container.querySelectorAll("[data-search-item]");
    expect(items.length).toBe(1);
  });

  test("shows 'No results found' when query matches nothing", () => {
    const sessions = [makeResult({ sessionId: "s1" })];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.change(modal.getByPlaceholderText("Search sessions..."), {
      target: { value: "zzzznotfound" },
    });

    expect(modal.getByText("No results found")).toBeTruthy();
  });

  test("limits displayed results to 20", () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      makeResult({ sessionId: `s${i}`, firstMessage: `Session ${i}` }),
    );
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );

    const items = container.querySelectorAll("[data-search-item]");
    expect(items.length).toBe(20);
  });

  test("calls onSelect with correct encodedPath and sessionId on click", () => {
    const onSelect = mock();
    const sessions = [makeResult({ sessionId: "s1", encodedPath: "-Users-dev-foo" })];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={onSelect} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.click(modal.getByText("Search test message"));

    expect(onSelect).toHaveBeenCalledWith("-Users-dev-foo", "s1");
  });

  test("calls onClose on Escape key", () => {
    const onClose = mock();
    const { container } = render(
      <SearchModal sessions={[makeResult()]} onSelect={mock()} onClose={onClose} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    fireEvent.keyDown(modal.getByPlaceholderText("Search sessions..."), { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  test("shows session type badges", () => {
    const sessions = [
      makeResult({ sessionId: "s1", sessionType: "plan" }),
      makeResult({ sessionId: "s2", sessionType: "implementation" }),
    ];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={mock()} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    expect(modal.getByText("plan")).toBeTruthy();
    expect(modal.getByText("implementation")).toBeTruthy();
  });

  test("keyboard navigation: ArrowDown/ArrowUp changes highlighted item, Enter selects", () => {
    const onSelect = mock();
    const sessions = [
      makeResult({ sessionId: "s1", firstMessage: "First item", encodedPath: "p1" }),
      makeResult({ sessionId: "s2", firstMessage: "Second item", encodedPath: "p2" }),
      makeResult({ sessionId: "s3", firstMessage: "Third item", encodedPath: "p3" }),
    ];
    const { container } = render(
      <SearchModal sessions={sessions} onSelect={onSelect} onClose={mock()} />,
    );
    const modal = within(container.querySelector(".search-modal")!);

    const input = modal.getByPlaceholderText("Search sessions...");
    const items = () => container.querySelectorAll("[data-search-item]");

    // Initially first item is highlighted
    expect(items()[0]!.classList.contains("highlighted")).toBe(true);

    // ArrowDown moves to second
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(items()[1]!.classList.contains("highlighted")).toBe(true);

    // ArrowDown moves to third
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(items()[2]!.classList.contains("highlighted")).toBe(true);

    // ArrowUp moves back to second
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(items()[1]!.classList.contains("highlighted")).toBe(true);

    // Enter selects the highlighted item
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("p2", "s2");
  });
});
