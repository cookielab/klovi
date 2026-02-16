import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { CollapsibleSection } from "./CollapsibleSection.tsx";

describe("CollapsibleSection", () => {
  test("renders title", () => {
    const { getByText } = render(
      <CollapsibleSection title="My Section">Content here</CollapsibleSection>,
    );
    expect(getByText("My Section")).not.toBeNull();
  });

  test("collapsed by default — content hidden", () => {
    const { container, queryByText } = render(
      <CollapsibleSection title="Title">Hidden content</CollapsibleSection>,
    );
    expect(queryByText("Hidden content")).toBeNull();
    const chevron = container.querySelector(".collapsible-chevron");
    expect(chevron!.classList.contains("open")).toBe(false);
  });

  test("expanded when defaultOpen=true", () => {
    const { getByText, container } = render(
      <CollapsibleSection title="Title" defaultOpen>
        Visible content
      </CollapsibleSection>,
    );
    expect(getByText("Visible content")).not.toBeNull();
    const chevron = container.querySelector(".collapsible-chevron");
    expect(chevron!.classList.contains("open")).toBe(true);
  });

  test("clicking header toggles open/close", () => {
    const { container, queryByText } = render(
      <CollapsibleSection title="Toggle">Toggled content</CollapsibleSection>,
    );
    const header = container.querySelector(".collapsible-header")!;

    // Initially closed
    expect(queryByText("Toggled content")).toBeNull();

    // Click to open
    fireEvent.click(header);
    expect(queryByText("Toggled content")).not.toBeNull();
    expect(container.querySelector(".collapsible-chevron")!.classList.contains("open")).toBe(true);

    // Click to close
    fireEvent.click(header);
    expect(queryByText("Toggled content")).toBeNull();
    expect(container.querySelector(".collapsible-chevron")!.classList.contains("open")).toBe(false);
  });

  test("renders JSX title", () => {
    const { container } = render(
      <CollapsibleSection title={<span data-testid="custom">Custom Title</span>}>
        Body
      </CollapsibleSection>,
    );
    expect(container.querySelector("[data-testid='custom']")).not.toBeNull();
  });
});
