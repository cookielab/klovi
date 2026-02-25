import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { Sidebar } from "./Sidebar.tsx";

describe("Sidebar", () => {
  afterEach(cleanup);

  test("renders Klovi title", () => {
    const { container } = render(
      <Sidebar>
        <div>Children</div>
      </Sidebar>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Klovi");
  });

  test("renders children in sidebar-content", () => {
    const { getByText } = render(
      <Sidebar>
        <div>My Child Content</div>
      </Sidebar>,
    );
    expect(getByText("My Child Content")).toBeTruthy();
  });

  test("renders search button when onSearchClick provided", () => {
    const onSearchClick = mock(() => {});
    const { container } = render(
      <Sidebar onSearchClick={onSearchClick}>
        <div>Content</div>
      </Sidebar>,
    );
    expect(container.querySelector(".btn-sidebar-search")).not.toBeNull();
  });

  test("does not render search button when onSearchClick not provided", () => {
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    expect(container.querySelector(".btn-sidebar-search")).toBeNull();
  });

  test("renders version info after fetch", async () => {
    setupMockRPC({
      getVersion: () => Promise.resolve({ version: "1.2.3", commit: "abc1234" }),
    });

    const { findByText } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    await findByText("1.2.3 (abc1234)");
  });

  test("renders version without commit hash when empty", async () => {
    setupMockRPC({
      getVersion: () => Promise.resolve({ version: "1.2.3", commit: "" }),
    });

    const { findByText } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    await findByText("1.2.3");
  });

  test("renders footer with cookielab link", () => {
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
    );
    const footer = container.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain("cookielab.io");
  });
});
