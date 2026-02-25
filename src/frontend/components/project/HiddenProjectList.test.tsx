import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project } from "../../../shared/types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { HiddenProjectList } from "./HiddenProjectList.tsx";

const SESSIONS_COUNT_REGEX = /8 sessions/;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    encodedPath: "proj1",
    name: "/Users/test/proj1",
    fullPath: "/Users/test/proj1",
    sessionCount: 5,
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

describe("HiddenProjectList", () => {
  afterEach(cleanup);

  test("shows loading state initially", () => {
    setupMockRPC({
      getProjects: () => new Promise(() => {}),
    });
    const { container } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={() => {}} onBack={() => {}} />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
  });

  test("renders hidden projects only", async () => {
    const projects = [
      makeProject({ encodedPath: "proj1", name: "/Users/test/proj1" }),
      makeProject({ encodedPath: "proj2", name: "/Users/test/proj2" }),
    ];
    setupMockRPC({
      getProjects: () => Promise.resolve({ projects }),
    });

    const { findByText, container } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={() => {}} onBack={() => {}} />,
    );
    await findByText("Hidden Projects");
    const items = container.querySelectorAll(".list-item");
    expect(items.length).toBe(1);
  });

  test("shows empty state when no hidden projects", async () => {
    const projects = [makeProject({ encodedPath: "proj1" })];
    setupMockRPC({
      getProjects: () => Promise.resolve({ projects }),
    });

    const { findByText } = render(
      <HiddenProjectList
        hiddenIds={new Set(["nonexistent"])}
        onUnhide={() => {}}
        onBack={() => {}}
      />,
    );
    await findByText("No hidden projects");
  });

  test("calls onUnhide when unhide button clicked", async () => {
    const projects = [makeProject({ encodedPath: "proj1" })];
    setupMockRPC({
      getProjects: () => Promise.resolve({ projects }),
    });

    const onUnhide = mock(() => {});
    const { findByText } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={onUnhide} onBack={() => {}} />,
    );
    const unhideBtn = await findByText("Unhide");
    fireEvent.click(unhideBtn);
    expect(onUnhide).toHaveBeenCalledTimes(1);
  });

  test("calls onBack when back button clicked", async () => {
    setupMockRPC({
      getProjects: () => Promise.resolve({ projects: [] }),
    });

    const onBack = mock(() => {});
    const { findByText } = render(
      <HiddenProjectList hiddenIds={new Set()} onUnhide={() => {}} onBack={onBack} />,
    );
    await findByText("No hidden projects");
    const backBtn = await findByText("← Back to projects");
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("displays session count per project", async () => {
    const projects = [makeProject({ encodedPath: "proj1", sessionCount: 8 })];
    setupMockRPC({
      getProjects: () => Promise.resolve({ projects }),
    });

    const { findByText } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={() => {}} onBack={() => {}} />,
    );
    await findByText(SESSIONS_COUNT_REGEX);
  });
});
