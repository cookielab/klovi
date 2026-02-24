import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { Onboarding } from "./Onboarding.tsx";

function makePlugin(overrides: Partial<PluginSettingInfo> = {}): PluginSettingInfo {
  return {
    id: "claude-code",
    displayName: "Claude Code",
    enabled: true,
    dataDir: "/Users/test/.claude",
    defaultDataDir: "/Users/test/.claude",
    isCustomDir: false,
    ...overrides,
  };
}

describe("Onboarding", () => {
  afterEach(cleanup);

  test("renders step 1 with security notice", () => {
    setupMockRPC();
    const { getByText } = render(<Onboarding onComplete={() => {}} />);
    expect(getByText("Session Data Notice")).toBeTruthy();
    expect(getByText(/sensitive information/)).toBeTruthy();
    expect(getByText(/fully local/)).toBeTruthy();
  });

  test("renders Next button on step 1", () => {
    setupMockRPC();
    const { getByRole } = render(<Onboarding onComplete={() => {}} />);
    expect(getByRole("button", { name: "Next" })).toBeTruthy();
  });

  test("does not show Get Started on step 1", () => {
    setupMockRPC();
    const { queryByRole } = render(<Onboarding onComplete={() => {}} />);
    expect(queryByRole("button", { name: "Get Started" })).toBeNull();
  });

  test("clicking Next shows step 2 with plugins", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", displayName: "Claude Code" }),
            makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
          ],
        }),
    });
    const { getByRole, findByText } = render(<Onboarding onComplete={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Next" }));
    expect(await findByText("Plugins")).toBeTruthy();
    expect(await findByText("Claude Code")).toBeTruthy();
    expect(await findByText("Codex CLI")).toBeTruthy();
  });

  test("step 2 shows Get Started button", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { getByRole, findByRole } = render(<Onboarding onComplete={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Next" }));
    expect(await findByRole("button", { name: "Get Started" })).toBeTruthy();
  });

  test("Get Started calls onComplete", async () => {
    const onComplete = mock(() => {});
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { getByRole, findByRole } = render(<Onboarding onComplete={onComplete} />);
    fireEvent.click(getByRole("button", { name: "Next" }));
    const btn = await findByRole("button", { name: "Get Started" });
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("Back button on step 2 returns to step 1", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { getByRole, findByRole, findByText } = render(<Onboarding onComplete={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Next" }));
    await findByText("Plugins");
    const backBtn = await findByRole("button", { name: "Back" });
    fireEvent.click(backBtn);
    expect(await findByText("Session Data Notice")).toBeTruthy();
  });

  test("renders step indicator dots", () => {
    setupMockRPC();
    const { container } = render(<Onboarding onComplete={() => {}} />);
    const dots = container.querySelectorAll(".onboarding-dot");
    expect(dots).toHaveLength(2);
  });

  test("renders Klovi logo on step 1", () => {
    setupMockRPC();
    const { container } = render(<Onboarding onComplete={() => {}} />);
    const img = container.querySelector(".onboarding-logo");
    expect(img).not.toBeNull();
  });
});
