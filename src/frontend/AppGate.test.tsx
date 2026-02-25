import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AppGate } from "./App.tsx";
import { setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
  afterEach(cleanup);

  // --- First launch (isFirstLaunch=true): show full Onboarding ---

  test("shows full onboarding on first launch", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("first launch: completing onboarding shows App", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
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

  test("first launch: saves showSecurityWarning=false on complete", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
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

  // --- Returning user + showSecurityWarning=true: show SecurityWarning ---

  test("returning user with warning enabled sees security warning", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
    });
    const { findByRole } = render(<AppGate />);
    expect(await findByRole("button", { name: "Accept & Continue" })).toBeTruthy();
  });

  test("returning user: Accept & Continue shows App", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
      acceptRisks: () => Promise.resolve({ ok: true }),
    });
    const { findByRole, findByText } = render(<AppGate />);
    const btn = await findByRole("button", { name: "Accept & Continue" });
    fireEvent.click(btn);
    await findByText("Welcome to Klovi");
  });

  test("returning user: checking dont-show saves setting", async () => {
    const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
      acceptRisks: () => Promise.resolve({ ok: true }),
      updateGeneralSettings,
    });
    const { findByRole, findByLabelText } = render(<AppGate />);
    const checkbox = await findByLabelText("Don't show this again");
    fireEvent.click(checkbox);
    const btn = await findByRole("button", { name: "Accept & Continue" });
    fireEvent.click(btn);
    expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
  });

  // --- Returning user + showSecurityWarning=false: skip straight to App ---

  test("returning user with warning disabled skips to App", async () => {
    const acceptRisks = mock(() => Promise.resolve({ ok: true }));
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
      acceptRisks,
    });
    const { findByText } = render(<AppGate />);
    await findByText("Welcome to Klovi");
    expect(acceptRisks).toHaveBeenCalledTimes(1);
  });

  // --- Error handling ---

  test("shows onboarding when isFirstLaunch fails", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("shows onboarding when getGeneralSettings fails for returning user", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
      getGeneralSettings: () => Promise.reject(new Error("RPC failed")),
    });
    const { findByText } = render(<AppGate />);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("App renders even if acceptRisks RPC fails", async () => {
    setupMockRPC({
      isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
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
});
