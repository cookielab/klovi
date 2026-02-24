import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AppGate } from "./App.tsx";
import { setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
  afterEach(cleanup);

  test("renders SecurityWarning initially", () => {
    setupMockRPC();
    const { getByText } = render(<AppGate />);
    expect(getByText("Session Data Notice")).toBeTruthy();
  });

  test("renders App after clicking Continue", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.resolve({ ok: true }),
    });
    const { getByRole, findByText } = render(<AppGate />);
    fireEvent.click(getByRole("button", { name: "Continue" }));
    await findByText("Welcome to Klovi");
  });

  test("renders App even if acceptRisks RPC fails", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.reject(new Error("RPC failed")),
    });
    const { getByRole, findByText } = render(<AppGate />);
    fireEvent.click(getByRole("button", { name: "Continue" }));
    await findByText("Welcome to Klovi");
  });

  test("does not render App before Continue is clicked", () => {
    setupMockRPC();
    const { queryByText } = render(<AppGate />);
    expect(queryByText("Welcome to Klovi")).toBeNull();
  });
});
