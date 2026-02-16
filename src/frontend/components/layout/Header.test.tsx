import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Header } from "./Header.tsx";

afterEach(cleanup);

function makeProps(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  return {
    title: "Test Session",
    themeSetting: "system" as const,
    onCycleTheme: mock(() => {}),
    fontSize: 14,
    onIncreaseFontSize: mock(() => {}),
    onDecreaseFontSize: mock(() => {}),
    presentationActive: false,
    onTogglePresentation: mock(() => {}),
    showPresentationToggle: false,
    ...overrides,
  };
}

describe("Header", () => {
  test("renders title", () => {
    const { container } = render(<Header {...makeProps()} />);
    expect(container.querySelector(".header-title")!.textContent).toContain("Test Session");
  });

  test("renders breadcrumb when provided", () => {
    const { container } = render(<Header {...makeProps({ breadcrumb: "My Project" })} />);
    expect(container.textContent).toContain("My Project");
  });

  test("does not render breadcrumb when not provided", () => {
    const { container } = render(<Header {...makeProps()} />);
    expect(container.textContent).not.toContain("/\u00a0");
  });

  test("renders back link when backHref provided", () => {
    const { container } = render(<Header {...makeProps({ backHref: "#/back" })} />);
    const backBtn = container.querySelector(".back-btn") as HTMLAnchorElement;
    expect(backBtn).not.toBeNull();
    expect(backBtn.href).toContain("#/back");
  });

  test("renders session type badge for plan", () => {
    const { container } = render(<Header {...makeProps({ sessionType: "plan" })} />);
    const badge = container.querySelector(".session-type-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Plan");
    expect(badge!.classList.contains("plan")).toBe(true);
  });

  test("renders session type badge for implementation", () => {
    const { container } = render(<Header {...makeProps({ sessionType: "implementation" })} />);
    const badge = container.querySelector(".session-type-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Impl");
  });

  test("does not render session type badge when not provided", () => {
    const { container } = render(<Header {...makeProps()} />);
    expect(container.querySelector(".session-type-badge")).toBeNull();
  });

  test("renders copy button when copyCommand provided", () => {
    const { container } = render(
      <Header {...makeProps({ copyCommand: "claude --resume abc123" })} />,
    );
    const copyBtn = container.querySelector(".btn-copy-command");
    expect(copyBtn).not.toBeNull();
  });

  test("does not render copy button when no copyCommand", () => {
    const { container } = render(<Header {...makeProps()} />);
    expect(container.querySelector(".btn-copy-command")).toBeNull();
  });

  test("displays current font size", () => {
    const { container } = render(<Header {...makeProps({ fontSize: 16 })} />);
    expect(container.textContent).toContain("16");
  });

  test("calls onIncreaseFontSize when A+ clicked", () => {
    const onIncreaseFontSize = mock(() => {});
    const { container } = render(<Header {...makeProps({ onIncreaseFontSize })} />);
    const buttons = container.querySelectorAll(".btn-icon");
    const plusBtn = Array.from(buttons).find((b) => b.textContent === "A+")!;
    fireEvent.click(plusBtn);
    expect(onIncreaseFontSize).toHaveBeenCalledTimes(1);
  });

  test("calls onDecreaseFontSize when A- clicked", () => {
    const onDecreaseFontSize = mock(() => {});
    const { container } = render(<Header {...makeProps({ onDecreaseFontSize })} />);
    const buttons = container.querySelectorAll(".btn-icon");
    const minusBtn = Array.from(buttons).find((b) => b.textContent === "A-")!;
    fireEvent.click(minusBtn);
    expect(onDecreaseFontSize).toHaveBeenCalledTimes(1);
  });

  test("calls onCycleTheme when theme button clicked", () => {
    const onCycleTheme = mock(() => {});
    const { getByText } = render(<Header {...makeProps({ onCycleTheme })} />);
    fireEvent.click(getByText("System"));
    expect(onCycleTheme).toHaveBeenCalledTimes(1);
  });

  test("displays correct theme label", () => {
    const { getByText } = render(<Header {...makeProps({ themeSetting: "light" })} />);
    expect(getByText("Light")).toBeTruthy();
  });

  test("displays dark theme label", () => {
    const { getByText } = render(<Header {...makeProps({ themeSetting: "dark" })} />);
    expect(getByText("Dark")).toBeTruthy();
  });

  test("shows presentation toggle when showPresentationToggle is true", () => {
    const { getByText } = render(<Header {...makeProps({ showPresentationToggle: true })} />);
    expect(getByText("Present")).toBeTruthy();
  });

  test("hides presentation toggle when showPresentationToggle is false", () => {
    const { container } = render(<Header {...makeProps({ showPresentationToggle: false })} />);
    expect(container.textContent).not.toContain("Present");
  });

  test("shows Exit Presentation when presentationActive", () => {
    const { getByText } = render(
      <Header {...makeProps({ showPresentationToggle: true, presentationActive: true })} />,
    );
    expect(getByText("Exit Presentation")).toBeTruthy();
  });

  test("calls onTogglePresentation when presentation button clicked", () => {
    const onTogglePresentation = mock(() => {});
    const { getByText } = render(
      <Header {...makeProps({ showPresentationToggle: true, onTogglePresentation })} />,
    );
    fireEvent.click(getByText("Present"));
    expect(onTogglePresentation).toHaveBeenCalledTimes(1);
  });
});
