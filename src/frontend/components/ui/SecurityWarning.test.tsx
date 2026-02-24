import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning.tsx";

describe("SecurityWarning", () => {
  afterEach(cleanup);

  test("renders warning heading and text", () => {
    const { getByText } = render(<SecurityWarning onAccept={() => {}} />);
    expect(getByText("Session Data Notice")).toBeTruthy();
    expect(getByText(/sensitive information/)).toBeTruthy();
    expect(getByText(/fully local/)).toBeTruthy();
    expect(getByText(/open source/)).toBeTruthy();
  });

  test("renders Continue button", () => {
    const { getByRole } = render(<SecurityWarning onAccept={() => {}} />);
    expect(getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  test("calls onAccept with false when Continue is clicked without checking box", () => {
    const onAccept = mock(() => {});
    const { getByRole } = render(<SecurityWarning onAccept={onAccept} />);
    fireEvent.click(getByRole("button", { name: "Continue" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(false);
  });

  test("renders Klovi logo", () => {
    const { container } = render(<SecurityWarning onAccept={() => {}} />);
    const img = container.querySelector(".security-warning-logo");
    expect(img).not.toBeNull();
  });

  test("renders 'Don't show this warning again' checkbox", () => {
    const { getByLabelText } = render(<SecurityWarning onAccept={() => {}} />);
    const checkbox = getByLabelText("Don't show this warning again");
    expect(checkbox).toBeTruthy();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  test("calls onAccept with true when checkbox is checked", () => {
    const onAccept = mock(() => {});
    const { getByLabelText, getByRole } = render(<SecurityWarning onAccept={onAccept} />);
    fireEvent.click(getByLabelText("Don't show this warning again"));
    fireEvent.click(getByRole("button", { name: "Continue" }));
    expect(onAccept).toHaveBeenCalledWith(true);
  });
});
