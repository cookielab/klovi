import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { Sidebar } from "./Sidebar.tsx";

describe("Sidebar", () => {
  afterEach(cleanup);

  test("renders Klovi title", () => {
    const { container } = render(
      <Sidebar>
        <div>Children</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(container.querySelector("h1")?.textContent).toBe("Klovi");
  });

  test("renders children in sidebar-content", () => {
    const { getByText } = render(
      <Sidebar>
        <div>My Child Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(getByText("My Child Content")).toBeTruthy();
  });

  test("renders search button when onSearchClick provided", () => {
    const onSearchClick = mock(() => {});
    const { getByTitle } = render(
      <Sidebar onSearchClick={onSearchClick}>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(getByTitle("Search sessions (Cmd+K)")).toBeTruthy();
  });

  test("does not render search button when onSearchClick not provided", () => {
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(container.querySelector("[title='Search sessions (Cmd+K)']")).toBeNull();
  });

  test("renders version info after fetch", async () => {
    setupMockRPC({
      getVersion: () => Promise.resolve({ version: "1.2.3", commit: "abc1234" }),
    });

    const { findByText } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
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
      { wrapper: MockProviders },
    );
    await findByText("1.2.3");
  });

  test("renders settings button when onSettingsClick provided", () => {
    const onSettingsClick = mock(() => {});
    const { getByTitle } = render(
      <Sidebar onSettingsClick={onSettingsClick}>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(getByTitle("Settings (Cmd+,)")).toBeTruthy();
  });

  test("does not render settings button when onSettingsClick not provided", () => {
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    expect(container.querySelector("[title='Settings (Cmd+,)']")).toBeNull();
  });

  test("renders footer with cookielab link", () => {
    const { container } = render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>,
      { wrapper: MockProviders },
    );
    const footer = container.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain("cookielab.io");
  });
});
