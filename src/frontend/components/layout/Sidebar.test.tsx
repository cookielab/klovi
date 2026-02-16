import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Sidebar } from "./Sidebar.tsx";

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: () => Promise<Response>): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

describe("Sidebar", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("renders Klovi title", () => {
    mockFetch(() => Promise.resolve(new Response("{}", { status: 200 })));
    const { container } = render(
      <Sidebar>
        <div>Children</div>
      </Sidebar>,
    );
    expect(container.querySelector("h1")!.textContent).toBe("Klovi");
  });

  test("renders children in sidebar-content", () => {
    mockFetch(() => Promise.resolve(new Response("{}", { status: 200 })));
    const { getByText } = render(
      <Sidebar>
        <div>My Child Content</div>
      </Sidebar>,
    );
    expect(getByText("My Child Content")).toBeTruthy();
  });

  test("renders search button when onSearchClick provided", () => {
    mockFetch(() => Promise.resolve(new Response("{}", { status: 200 })));
    const onSearchClick = mock(() => {});
    const { container } = render(
      <Sidebar onSearchClick={onSearchClick}>
        <div>Content</div>
      </Sidebar>,
    );
    expect(container.querySelector(".btn-sidebar-search")).not.toBeNull();
  });

  test("does not render search button when onSearchClick not provided", () => {
    mockFetch(() => Promise.resolve(new Response("{}", { status: 200 })));
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    expect(container.querySelector(".btn-sidebar-search")).toBeNull();
  });

  test("renders version info after fetch", async () => {
    const versionData = { version: "1.2.3", commitHash: "abc1234" };
    mockFetch(() => Promise.resolve(new Response(JSON.stringify(versionData), { status: 200 })));

    const { findByText } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    await findByText("1.2.3 (abc1234)");
  });

  test("renders version without commit hash when null", async () => {
    const versionData = { version: "1.2.3", commitHash: null };
    mockFetch(() => Promise.resolve(new Response(JSON.stringify(versionData), { status: 200 })));

    const { findByText } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    await findByText("1.2.3");
  });

  test("renders footer with cookielab link", () => {
    mockFetch(() => Promise.resolve(new Response("{}", { status: 200 })));
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    const footer = container.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain("cookielab.io");
  });
});
