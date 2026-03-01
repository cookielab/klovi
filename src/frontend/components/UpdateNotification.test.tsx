import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { setupMockRPC } from "../test-helpers/mock-rpc.ts";
import { UpdateNotification } from "./UpdateNotification.tsx";

const VERSION_READY_PATTERN = /v2\.0\.0 is ready/;

describe("UpdateNotification", () => {
  afterEach(cleanup);

  test("renders nothing when status is up-to-date", () => {
    const { container } = render(
      <UpdateNotification
        status={{ status: "up-to-date", currentVersion: "1.0.0" }}
        dismissed={false}
        onDismiss={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders nothing when dismissed", () => {
    setupMockRPC();
    const { container } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        dismissed={true}
        onDismiss={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("renders notification when status is ready", () => {
    setupMockRPC();
    const { getByText } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        dismissed={false}
        onDismiss={() => {}}
      />,
    );
    expect(getByText(VERSION_READY_PATTERN)).toBeDefined();
  });

  test("renders Restart button when ready", () => {
    setupMockRPC();
    const { getByRole } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        dismissed={false}
        onDismiss={() => {}}
      />,
    );
    expect(getByRole("button", { name: "Restart to update" })).toBeDefined();
  });

  test("calls onDismiss when dismiss button clicked", () => {
    setupMockRPC();
    const onDismiss = mock();
    const { getByLabelText } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        dismissed={false}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalled();
  });

  test("calls applyUpdate RPC when Restart clicked", () => {
    const applyUpdate = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({ applyUpdate });
    const { getByRole } = render(
      <UpdateNotification
        status={{ status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" }}
        dismissed={false}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Restart to update" }));
    expect(applyUpdate).toHaveBeenCalled();
  });
});
