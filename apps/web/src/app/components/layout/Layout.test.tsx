import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Layout } from "./Layout.tsx";

afterEach(cleanup);

describe("Layout", () => {
  test("renders sidebar content", () => {
    const { getByText } = render(
      <Layout sidebar={<div>Sidebar Content</div>}>
        <div>Main Content</div>
      </Layout>,
    );
    expect(getByText("Sidebar Content")).toBeTruthy();
  });

  test("renders main content", () => {
    const { getByText } = render(
      <Layout sidebar={<div>Sidebar</div>}>
        <div>Main Content</div>
      </Layout>,
    );
    expect(getByText("Main Content")).toBeTruthy();
  });

  test("applies sidebar-hidden class when hideSidebar is true", () => {
    const { container } = render(
      <Layout sidebar={<div>Sidebar</div>} hideSidebar>
        <div>Content</div>
      </Layout>,
    );
    expect(container.querySelector(".app-layout.sidebar-hidden")).not.toBeNull();
  });

  test("does not apply sidebar-hidden class by default", () => {
    const { container } = render(
      <Layout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </Layout>,
    );
    expect(container.querySelector(".sidebar-hidden")).toBeNull();
  });

  test("has main-content wrapper", () => {
    const { container } = render(
      <Layout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </Layout>,
    );
    expect(container.querySelector(".main-content")).not.toBeNull();
  });
});
