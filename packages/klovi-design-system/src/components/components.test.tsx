import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Badge } from "./Badge/Badge.tsx";
import { Button } from "./Button/Button.tsx";
import { Collapsible } from "./Collapsible/Collapsible.tsx";
import { Input, SegmentedControl, Select, Toggle } from "./FormControls/index.ts";
import { AppLayout, ContentHeader, Sidebar } from "./Layout/index.ts";
import { Modal } from "./Modal/Modal.tsx";

const DETAILS_BUTTON_NAME = /details/i;

afterEach(cleanup);

describe("design-system components", () => {
  test("Button forwards props and handles clicks", () => {
    const onClick = mock(() => {});

    const { getByRole } = render(
      <Button variant="primary" size="sm" icon className="custom" onClick={onClick}>
        Save
      </Button>,
    );

    const button = getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
    expect(button.className).toContain("custom");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("Collapsible toggles content visibility", () => {
    const { queryByText, getByRole } = render(
      <Collapsible title="Details">
        <div>Hidden content</div>
      </Collapsible>,
    );

    expect(queryByText("Hidden content")).toBeNull();

    fireEvent.click(getByRole("button", { name: DETAILS_BUTTON_NAME }));
    expect(queryByText("Hidden content")).toBeTruthy();

    fireEvent.click(getByRole("button", { name: DETAILS_BUTTON_NAME }));
    expect(queryByText("Hidden content")).toBeNull();
  });

  test("Modal handles overlay clicks, escape, and inner click propagation", () => {
    const onClose = mock(() => {});

    const { getByRole, getByText, rerender } = render(
      <Modal open onClose={onClose} width={640}>
        <button type="button">Inner</button>
      </Modal>,
    );

    const dialog = getByRole("dialog") as HTMLDivElement;
    expect(dialog.style.width).toBe("640px");

    fireEvent.click(getByText("Inner"));
    expect(onClose).toHaveBeenCalledTimes(0);

    const overlay = dialog.parentElement;
    if (!overlay) throw new Error("Missing modal overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Modal open={false} onClose={onClose}>
        <div>Closed</div>
      </Modal>,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("SegmentedControl respects value, onChange, and disabled state", () => {
    const onChange = mock(() => {});

    const { getByRole, rerender } = render(
      <SegmentedControl
        value="light"
        onChange={onChange}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");

    rerender(
      <SegmentedControl
        value="light"
        onChange={onChange}
        disabled
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("Input, Select, and Toggle render and wire through props", () => {
    let inputChanges = 0;
    let selectChanges = 0;
    const onToggle = mock((_checked: boolean) => {});

    const { getByLabelText, getByRole } = render(
      <div>
        <label htmlFor="name">Name</label>
        <Input
          id="name"
          value="Jane"
          onChange={() => {
            inputChanges++;
          }}
        />

        <label htmlFor="theme">Theme</label>
        <Select
          id="theme"
          value="light"
          onChange={() => {
            selectChanges++;
          }}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />

        <Toggle checked onChange={onToggle} label="Enabled" />
      </div>,
    );

    const input = getByLabelText("Name") as HTMLInputElement;
    const select = getByLabelText("Theme") as HTMLSelectElement;
    const toggle = getByRole("checkbox", { name: "Enabled" }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "John" } });
    fireEvent.change(select, { target: { value: "dark" } });
    fireEvent.click(toggle);

    expect(inputChanges).toBe(1);
    expect(selectChanges).toBe(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("layout primitives render expected sections", () => {
    const { getByText } = render(
      <AppLayout
        sidebar={
          <Sidebar header="Top" footer="Bottom">
            Menu
          </Sidebar>
        }
        hideSidebar
      >
        <ContentHeader left="Left" right="Right" />
        <div>Main content</div>
      </AppLayout>,
    );

    expect(getByText("Top")).toBeTruthy();
    expect(getByText("Menu")).toBeTruthy();
    expect(getByText("Bottom")).toBeTruthy();
    expect(getByText("Left")).toBeTruthy();
    expect(getByText("Right")).toBeTruthy();
    expect(getByText("Main content")).toBeTruthy();
  });

  test("Badge renders content for multiple variants", () => {
    const { getByText, rerender } = render(<Badge>Default</Badge>);
    expect(getByText("Default")).toBeTruthy();

    rerender(
      <Badge variant="plan" mono>
        Plan
      </Badge>,
    );

    expect(getByText("Plan")).toBeTruthy();
  });
});
