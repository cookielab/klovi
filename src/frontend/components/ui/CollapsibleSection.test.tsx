import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { CollapsibleSection } from "./CollapsibleSection.tsx";

afterEach(cleanup);

describe("CollapsibleSection", () => {
  test("renders title", () => {
    const { getByText } = render(
      <CollapsibleSection title="My Section">Content here</CollapsibleSection>,
    );
    expect(getByText("My Section")).not.toBeNull();
  });

  test("collapsed by default -- content hidden", () => {
    const { queryByText } = render(
      <CollapsibleSection title="Title">Hidden content</CollapsibleSection>,
    );
    expect(queryByText("Hidden content")).toBeNull();
  });

  test("expanded when defaultOpen=true", () => {
    const { getByText } = render(
      <CollapsibleSection title="Title" defaultOpen>
        Visible content
      </CollapsibleSection>,
    );
    expect(getByText("Visible content")).not.toBeNull();
  });

  test("clicking header toggles open/close", () => {
    const { getByRole, queryByText } = render(
      <CollapsibleSection title="Toggle">Toggled content</CollapsibleSection>,
    );
    const header = getByRole("button");

    // Initially closed
    expect(queryByText("Toggled content")).toBeNull();

    // Click to open
    fireEvent.click(header);
    expect(queryByText("Toggled content")).not.toBeNull();

    // Click to close
    fireEvent.click(header);
    expect(queryByText("Toggled content")).toBeNull();
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
