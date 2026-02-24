import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AppGate } from "./App.tsx";
import { setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
  afterEach(cleanup);

  test("renders Onboarding step 1 after loading", async () => {
    setupMockRPC();
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("renders App after completing onboarding", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.resolve({ ok: true }),
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    await findByText("Welcome to Klovi");
  });

  test("renders App even if acceptRisks RPC fails", async () => {
    setupMockRPC({
      acceptRisks: () => Promise.reject(new Error("RPC failed")),
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    await findByText("Welcome to Klovi");
  });

  test("does not render App before onboarding is completed", async () => {
    setupMockRPC();
    const { findByText, queryByText } = render(<AppGate />);
    await findByText("Session Data Notice");
    expect(queryByText("Welcome to Klovi")).toBeNull();
  });

  test("skips onboarding when showSecurityWarning is false", async () => {
    const acceptRisks = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
      acceptRisks,
    });
    const { findByText } = render(<AppGate />);
    await findByText("Welcome to Klovi");
    expect(acceptRisks).toHaveBeenCalledTimes(1);
  });

  test("always saves showSecurityWarning false on complete", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      updateGeneralSettings,
      getPluginSettings: () => Promise.resolve({ plugins: [] }),
    });
    const { findByRole } = render(<AppGate />);
    const nextBtn = await findByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    const startBtn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(startBtn);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
  });

  test("shows onboarding when getGeneralSettings fails", async () => {
    setupMockRPC({
      getGeneralSettings: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });
});
