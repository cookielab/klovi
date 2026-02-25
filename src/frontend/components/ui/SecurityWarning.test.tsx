import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning.tsx";

const SENSITIVE_INFO_REGEX = /sensitive information/;
const FULLY_LOCAL_REGEX = /fully local/;

describe("SecurityWarning", () => {
  afterEach(cleanup);

  test("renders Session Data Notice heading", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText("Session Data Notice")).toBeTruthy();
  });

  test("renders sensitive information text", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText(SENSITIVE_INFO_REGEX)).toBeTruthy();
  });

  test("renders fully local text", () => {
    const { getByText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByText(FULLY_LOCAL_REGEX)).toBeTruthy();
  });

  test("renders Accept & Continue button", () => {
    const { getByRole } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
  });

  test("renders Don't show this again checkbox", () => {
    const { getByLabelText } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(getByLabelText("Don't show this again")).toBeTruthy();
  });

  test("clicking Accept & Continue calls onAccept", () => {
    const onAccept = mock(() => {});
    const { getByRole } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={() => {}} />,
    );
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("checking checkbox and clicking Accept calls onDontShowAgain", () => {
    const onDontShowAgain = mock(() => {});
    const onAccept = mock(() => {});
    const { getByRole, getByLabelText } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
    );
    fireEvent.click(getByLabelText("Don't show this again"));
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("clicking Accept without checkbox does not call onDontShowAgain", () => {
    const onDontShowAgain = mock(() => {});
    const onAccept = mock(() => {});
    const { getByRole } = render(
      <SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
    );
    fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
    expect(onDontShowAgain).not.toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("renders Klovi logo", () => {
    const { container } = render(
      <SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />,
    );
    expect(container.querySelector(".onboarding-logo")).not.toBeNull();
  });
});
