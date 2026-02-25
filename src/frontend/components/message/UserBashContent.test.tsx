import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { UserTurn } from "../../../shared/types.ts";
import { UserBashContent } from "./UserBashContent.tsx";

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
    const { container } = render(<UserBashContent turn={makeTurn({ bashInput: "ls -la" })} />);
    const label = container.querySelector(".tool-section-label");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Command");
    // No output section
    const labels = container.querySelectorAll(".tool-section-label");
    expect(labels).toHaveLength(1);
  });

  test("output-only rendering (bashStdout only)", () => {
    const { container } = render(
      <UserBashContent turn={makeTurn({ bashStdout: "hello world" })} />,
    );
    const labels = container.querySelectorAll(".tool-section-label");
    expect(labels).toHaveLength(1);
    expect(labels[0]?.textContent).toBe("Output");
  });

  test("combined command + output", () => {
    const { container } = render(
      <UserBashContent turn={makeTurn({ bashInput: "echo hi", bashStdout: "hi" })} />,
    );
    const labels = container.querySelectorAll(".tool-section-label");
    expect(labels).toHaveLength(2);
    expect(labels[0]?.textContent).toBe("Command");
    expect(labels[1]?.textContent).toBe("Output");
  });

  test("stderr-only marked as error", () => {
    const { container } = render(
      <UserBashContent turn={makeTurn({ bashStderr: "fatal error" })} />,
    );
    const errorEl = container.querySelector(".tool-call-error");
    expect(errorEl).not.toBeNull();
  });

  test("stdout + stderr not marked as error", () => {
    const { container } = render(
      <UserBashContent
        turn={makeTurn({ bashStdout: "some output", bashStderr: "some warning" })}
      />,
    );
    const errorEl = container.querySelector(".tool-call-error");
    expect(errorEl).toBeNull();
  });
});
