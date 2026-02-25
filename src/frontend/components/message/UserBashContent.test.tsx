import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { UserTurn } from "../../../shared/types.ts";
import { UserBashContent } from "./UserBashContent.tsx";

afterEach(cleanup);

function makeTurn(overrides: Partial<UserTurn> = {}): UserTurn {
  return {
    kind: "user",
    uuid: "u1",
    timestamp: "2024-01-15T10:00:00Z",
    text: "",
    ...overrides,
  };
}

describe("UserBashContent", () => {
  test("command-only rendering (bashInput only)", () => {
    const { getByText, queryByText } = render(
      <UserBashContent turn={makeTurn({ bashInput: "ls -la" })} />,
    );
    expect(getByText("Command")).toBeTruthy();
    // No output section
    expect(queryByText("Output")).toBeNull();
  });

  test("output-only rendering (bashStdout only)", () => {
    const { getByText } = render(
      <UserBashContent turn={makeTurn({ bashStdout: "hello world" })} />,
    );
    expect(getByText("Output")).toBeTruthy();
  });

  test("combined command + output", () => {
    const { getByText } = render(
      <UserBashContent turn={makeTurn({ bashInput: "echo hi", bashStdout: "hi" })} />,
    );
    expect(getByText("Command")).toBeTruthy();
    expect(getByText("Output")).toBeTruthy();
  });

  test("stderr-only marked as error", () => {
    const { container } = render(
      <UserBashContent turn={makeTurn({ bashStderr: "fatal error" })} />,
    );
    expect(container.textContent).toContain("fatal error");
  });

  test("stdout + stderr not marked as error", () => {
    const { container } = render(
      <UserBashContent
        turn={makeTurn({ bashStdout: "some output", bashStderr: "some warning" })}
      />,
    );
    expect(container.textContent).toContain("some output");
    expect(container.textContent).toContain("some warning");
  });
});
