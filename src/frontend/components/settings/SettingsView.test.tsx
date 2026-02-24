import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SettingsSidebar, type SettingsTab } from "./SettingsSidebar.tsx";
import { SettingsView } from "./SettingsView.tsx";

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

function defaultProps() {
  return {
    activeTab: "general" as SettingsTab,
    onNavigateHome: mock(),
    theme: { setting: "system" as const, set: mock() },
    fontSize: { size: 15, set: mock(), increase: mock(), decrease: mock() },
    presentationTheme: {
      setting: "system" as const,
      sameAsGlobal: true,
      setSameAsGlobal: mock(),
      set: mock(),
    },
    presentationFontSize: {
      size: 15,
      sameAsGlobal: true,
      setSameAsGlobal: mock(),
      set: mock(),
      increase: mock(),
      decrease: mock(),
    },
  };
}

describe("SettingsView", () => {
  afterEach(cleanup);

  test("renders General content by default", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByText } = render(<SettingsView {...defaultProps()} />);
    await findByText("Show on-boarding on startup");
  });

  test("renders plugin list when activeTab is plugins", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({ id: "claude-code", displayName: "Claude Code" }),
            makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
          ],
        }),
    });
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findByText } = render(<SettingsView {...props} />);
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
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findAllByRole } = render(<SettingsView {...props} />);
    const checkboxes = await findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  test("shows default path as placeholder when not customized", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ isCustomDir: false, defaultDataDir: "/Users/test/.claude" })],
        }),
    });
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findByPlaceholderText } = render(<SettingsView {...props} />);
    const input = await findByPlaceholderText("/Users/test/.claude");
    expect((input as HTMLInputElement).value).toBe("");
  });

  test("shows custom path as value when customized", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [
            makePlugin({
              isCustomDir: true,
              dataDir: "/custom/path",
              defaultDataDir: "/Users/test/.claude",
            }),
          ],
        }),
    });
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findByDisplayValue } = render(<SettingsView {...props} />);
    await findByDisplayValue("/custom/path");
  });

  test("shows Reset link when path is customized", async () => {
    setupMockRPC({
      getPluginSettings: () =>
        Promise.resolve({
          plugins: [makePlugin({ isCustomDir: true, dataDir: "/custom/path" })],
        }),
    });
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findByText } = render(<SettingsView {...props} />);
    await findByText("Reset");
  });

  test("does not show Reset link for default path", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin({ isCustomDir: false })] }),
    });
    const props = defaultProps();
    props.activeTab = "plugins";
    const { findByText, queryByText } = render(<SettingsView {...props} />);
    await findByText("Claude Code");
    expect(queryByText("Reset")).toBeNull();
  });

  test("General tab reflects persisted value", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
      getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
    });
    const { findByLabelText } = render(<SettingsView {...defaultProps()} />);
    const checkbox = await findByLabelText("Show on-boarding on startup");
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  test("General tab shows Global and Presentation subsections", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findByText } = render(<SettingsView {...defaultProps()} />);
    await findByText("Global");
    await findByText("Presentation");
  });

  test("General tab shows theme selector with System/Light/Dark options", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    const { findAllByText } = render(<SettingsView {...props} />);
    // Both global and presentation have these options
    const systemButtons = await findAllByText("System");
    expect(systemButtons.length).toBeGreaterThanOrEqual(2);
  });

  test("theme selector calls set when option clicked", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    const { findAllByText } = render(<SettingsView {...props} />);
    const darkButtons = await findAllByText("Dark");
    // First Dark button is in Global section
    fireEvent.click(darkButtons[0]!);
    expect(props.theme.set).toHaveBeenCalledWith("dark");
  });

  test("font size controls call increase/decrease", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    const { findAllByText } = render(<SettingsView {...props} />);
    const plusButtons = await findAllByText("A+");
    const minusButtons = await findAllByText("A-");
    fireEvent.click(plusButtons[0]!);
    expect(props.fontSize.increase).toHaveBeenCalled();
    fireEvent.click(minusButtons[0]!);
    expect(props.fontSize.decrease).toHaveBeenCalled();
  });

  test("presentation theme selector is disabled when sameAsGlobal is true", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    props.presentationTheme.sameAsGlobal = true;
    const { container, findByText } = render(<SettingsView {...props} />);
    await findByText("Presentation");
    const selectors = container.querySelectorAll(".settings-theme-selector");
    // Second selector is presentation
    expect(selectors[1]!.classList.contains("disabled")).toBe(true);
  });

  test("presentation theme selector is enabled when sameAsGlobal is false", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    props.presentationTheme.sameAsGlobal = false;
    const { container, findByText } = render(<SettingsView {...props} />);
    await findByText("Presentation");
    const selectors = container.querySelectorAll(".settings-theme-selector");
    expect(selectors[1]!.classList.contains("disabled")).toBe(false);
  });

  test("presentation font-size control is disabled when sameAsGlobal is true", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    props.presentationFontSize.sameAsGlobal = true;
    const { container, findByText } = render(<SettingsView {...props} />);
    await findByText("Presentation");
    const controls = container.querySelectorAll(".settings-font-size-control");
    expect(controls[1]!.classList.contains("disabled")).toBe(true);
  });

  test("Same as global checkboxes are rendered", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const { findAllByLabelText } = render(<SettingsView {...defaultProps()} />);
    const sameLabels = await findAllByLabelText("Same as global");
    expect(sameLabels).toHaveLength(2);
  });

  test("unchecking Same as global calls setSameAsGlobal(false)", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    const { findAllByLabelText } = render(<SettingsView {...props} />);
    const sameLabels = await findAllByLabelText("Same as global");
    // First is theme, second is font size
    fireEvent.click(sameLabels[0]!);
    expect(props.presentationTheme.setSameAsGlobal).toHaveBeenCalledWith(false);
    fireEvent.click(sameLabels[1]!);
    expect(props.presentationFontSize.setSameAsGlobal).toHaveBeenCalledWith(false);
  });

  test("General tab shows font size value", async () => {
    setupMockRPC({
      getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
    });
    const props = defaultProps();
    props.fontSize.size = 20;
    const { findByText } = render(<SettingsView {...props} />);
    await findByText("20");
  });
});

describe("SettingsSidebar", () => {
  afterEach(cleanup);

  test("renders General and Plugins buttons", () => {
    const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => {}} />);
    expect(getByRole("button", { name: "General" })).toBeDefined();
    expect(getByRole("button", { name: "Plugins" })).toBeDefined();
  });

  test("marks General as active when activeTab is general", () => {
    const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => {}} />);
    expect(getByRole("button", { name: "General" }).classList.contains("active")).toBe(true);
    expect(getByRole("button", { name: "Plugins" }).classList.contains("active")).toBe(false);
  });

  test("marks Plugins as active when activeTab is plugins", () => {
    const { getByRole } = render(<SettingsSidebar activeTab="plugins" onTabChange={() => {}} />);
    expect(getByRole("button", { name: "General" }).classList.contains("active")).toBe(false);
    expect(getByRole("button", { name: "Plugins" }).classList.contains("active")).toBe(true);
  });

  test("calls onTabChange when clicking a tab", () => {
    const onTabChange = mock();
    const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={onTabChange} />);
    fireEvent.click(getByRole("button", { name: "Plugins" }));
    expect(onTabChange).toHaveBeenCalledWith("plugins");
  });
});
