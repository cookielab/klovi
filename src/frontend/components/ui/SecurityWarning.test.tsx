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

  test("calls onAccept when Continue is clicked", () => {
    const onAccept = mock(() => {});
    const { getByRole } = render(<SecurityWarning onAccept={onAccept} />);
    fireEvent.click(getByRole("button", { name: "Continue" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("renders Klovi logo", () => {
    const { container } = render(<SecurityWarning onAccept={() => {}} />);
    const img = container.querySelector(".security-warning-logo");
    expect(img).not.toBeNull();
  });
});
