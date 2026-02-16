import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project } from "../../../shared/types.ts";
import { HiddenProjectList } from "./HiddenProjectList.tsx";

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: () => Promise<Response>): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

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
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {}));
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
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText, container } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={() => {}} onBack={() => {}} />,
    );
    await findByText("Hidden Projects");
    const items = container.querySelectorAll(".list-item");
    expect(items.length).toBe(1);
  });

  test("shows empty state when no hidden projects", async () => {
    const projects = [makeProject({ encodedPath: "proj1" })];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

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
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const onUnhide = mock(() => {});
    const { findByText } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={onUnhide} onBack={() => {}} />,
    );
    const unhideBtn = await findByText("Unhide");
    fireEvent.click(unhideBtn);
    expect(onUnhide).toHaveBeenCalledTimes(1);
  });

  test("calls onBack when back button clicked", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [] }), { status: 200 })),
    );

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
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText } = render(
      <HiddenProjectList hiddenIds={new Set(["proj1"])} onUnhide={() => {}} onBack={() => {}} />,
    );
    await findByText(/8 sessions/);
  });
});
