import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SettingsModal } from "./SettingsModal.tsx";

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

describe("SettingsModal", () => {
  afterEach(cleanup);

  test("renders Settings heading", () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { getByText } = render(<SettingsModal onClose={mock()} />);
    expect(getByText("Settings")).toBeTruthy();
  });

  test("renders plugin list with display names", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", displayName: "Claude Code" }),
            makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
          ],
        }),
    });
    const { findByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Claude Code");
    await findByText("Codex CLI");
  });

  test("renders checkbox for each plugin", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", enabled: true }),
            makePlugin({ id: "codex-cli", enabled: false }),
          ],
        }),
    });
    const { findAllByRole } = render(<SettingsModal onClose={mock()} />);
    const checkboxes = await findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  test("renders data directory path", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ dataDir: "/Users/test/.claude" })],
        }),
    });
    const { findByDisplayValue } = render(<SettingsModal onClose={mock()} />);
    await findByDisplayValue("/Users/test/.claude");
  });

  test("calls onClose with false when X button is clicked without changes", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByLabelText } = render(<SettingsModal onClose={onClose} />);
    const closeBtn = await findByLabelText("Close settings");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  test("calls onClose when Escape is pressed", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { container, findByText } = render(<SettingsModal onClose={onClose} />);
    await findByText("Claude Code");
    fireEvent.keyDown(container, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when backdrop is clicked", async () => {
    const onClose = mock();
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { container, findByText } = render(<SettingsModal onClose={onClose} />);
    await findByText("Claude Code");
    const overlay = container.querySelector(".settings-overlay")!;
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("shows Reset link when path is customized", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ isCustomDir: true, dataDir: "/custom/path" })],
        }),
    });
    const { findByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Reset");
  });

  test("does not show Reset link for default path", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin({ isCustomDir: false })] }),
    });
    const { findByText, queryByText } = render(<SettingsModal onClose={mock()} />);
    await findByText("Claude Code");
    expect(queryByText("Reset")).toBeNull();
  });

  test("shows Plugins section tab as active", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByRole } = render(<SettingsModal onClose={mock()} />);
    const tab = await findByRole("button", { name: "Plugins" });
    expect(tab.classList.contains("active") || tab.closest(".active")).toBeTruthy();
  });
});
