import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AppGate } from "./App.tsx";
import { setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
  afterEach(cleanup);

  test("renders SecurityWarning after loading", async () => {
    setupMockRPC();
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("renders App after clicking Continue", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.resolve({ ok: true }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const btn = await findByRole("button", { name: "Continue" });
    fireEvent.click(btn);
    await findByText("Welcome to Klovi");
  });

  test("renders App even if acceptRisks RPC fails", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const btn = await findByRole("button", { name: "Continue" });
    fireEvent.click(btn);
    await findByText("Welcome to Klovi");
  });

  test("does not render App before Continue is clicked", async () => {
    setupMockRPC();
    const { findByText, queryByText } = render(<AppGate />);
    await findByText("Session Data Notice");
    expect(queryByText("Welcome to Klovi")).toBeNull();
  });

  test("skips warning when showSecurityWarning is false", async () => {
    const acceptRisks = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
      acceptRisks,
    });
    const { findByText } = render(<AppGate />);
    await findByText("Welcome to Klovi");
    expect(acceptRisks).toHaveBeenCalledTimes(1);
  });

  test("saves preference when checkbox is checked", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      updateGeneralSettings,
    });
    const { findByLabelText, findByRole } = render(<AppGate />);
    const checkbox = await findByLabelText("Don't show this warning again");
    fireEvent.click(checkbox);
    const btn = await findByRole("button", { name: "Continue" });
    fireEvent.click(btn);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
  });

  test("shows warning when getGeneralSettings fails", async () => {
    setupMockRPC({
      getGeneralSettings: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });
});
