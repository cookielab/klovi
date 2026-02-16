import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project } from "../../../shared/types.ts";
import { ProjectList } from "./ProjectList.tsx";

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: () => Promise<Response>): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    encodedPath: "test-project",
    name: "/Users/test/project",
    fullPath: "/Users/test/project",
    sessionCount: 5,
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

describe("ProjectList", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {})); // Never resolves
    const { container } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
  });

  test("renders projects after fetch", async () => {
    const projects = [
      makeProject({ encodedPath: "proj1", name: "/Users/test/proj1" }),
      makeProject({ encodedPath: "proj2", name: "/Users/test/proj2" }),
    ];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText, container } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (2)");
    const items = container.querySelectorAll(".list-item");
    expect(items.length).toBe(2);
  });

  test("filters hidden projects", async () => {
    const projects = [
      makeProject({ encodedPath: "proj1", name: "/Users/test/proj1" }),
      makeProject({ encodedPath: "proj2", name: "/Users/test/proj2" }),
    ];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set(["proj1"])}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (1)");
  });

  test("calls onSelect when project clicked", async () => {
    const project = makeProject({ encodedPath: "proj1", name: "/Users/test/proj1" });
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [project] }), { status: 200 })),
    );

    const onSelect = mock(() => {});
    const { container, findByText } = render(
      <ProjectList
        onSelect={onSelect}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (1)");
    const item = container.querySelector(".list-item")!;
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("filter input narrows displayed projects", async () => {
    const projects = [
      makeProject({ encodedPath: "alpha", name: "/Users/test/alpha" }),
      makeProject({ encodedPath: "beta", name: "/Users/test/beta" }),
    ];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { container, findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (2)");

    const input = container.querySelector(".filter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alpha" } });

    expect(container.querySelectorAll(".list-item").length).toBe(1);
  });

  test("shows empty message when no projects match", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [] }), { status: 200 })),
    );

    const { findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("No projects found");
  });

  test("shows hidden projects link when there are hidden projects", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [] }), { status: 200 })),
    );

    const { findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set(["proj1", "proj2"])}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("2 hidden projects");
  });

  test("calls onHide when hide button clicked", async () => {
    const project = makeProject({ encodedPath: "proj1" });
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [project] }), { status: 200 })),
    );

    const onHide = mock(() => {});
    const { container, findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={onHide}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (1)");
    const hideBtn = container.querySelector(".btn-hide")!;
    fireEvent.click(hideBtn);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("displays session count per project", async () => {
    const projects = [makeProject({ sessionCount: 12 })];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText(/12 sessions/);
  });

  test("singular session count", async () => {
    const projects = [makeProject({ sessionCount: 1 })];
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ projects }), { status: 200 })));

    const { findByText } = render(
      <ProjectList
        onSelect={() => {}}
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText(/1 session[^s]/);
  });

  test("marks selected project as active", async () => {
    const project = makeProject({ encodedPath: "proj1" });
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ projects: [project] }), { status: 200 })),
    );

    const { container, findByText } = render(
      <ProjectList
        onSelect={() => {}}
        selected="proj1"
        hiddenIds={new Set()}
        onHide={() => {}}
        onShowHidden={() => {}}
      />,
    );
    await findByText("Projects (1)");
    expect(container.querySelector(".list-item.active")).not.toBeNull();
  });
});
