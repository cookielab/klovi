import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc";
import { SettingsSidebar, type SettingsTab } from "./SettingsSidebar";
import { SettingsView } from "./SettingsView";

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

	it("renders General content by default", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { findByText } = render(<SettingsView {...defaultProps()} />, { wrapper: MockProviders });
		expect(await findByText("Show security warning on startup")).toBeTruthy();
	});

	it("renders plugin list when activeTab is plugins", async () => {
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
		const { findByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		expect(await findByText("Claude Code")).toBeTruthy();
		expect(await findByText("Codex CLI")).toBeTruthy();
	});

	it("renders Cursor as beta on the plugins page", async () => {
		setupMockRPC({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [makePlugin({ id: "cursor", displayName: "Cursor", defaultDataDir: "/Users/test/.cursor" })],
				}),
		});
		const props = defaultProps();
		props.activeTab = "plugins";
		const { findByText, queryByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		expect(await findByText("Cursor (beta)")).toBeTruthy();
		expect(queryByText("Cursor")).toBeNull();
	});

	it("renders checkbox for each plugin", async () => {
		setupMockRPC({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [makePlugin({ id: "claude-code", enabled: true }), makePlugin({ id: "codex-cli", enabled: false })],
				}),
		});
		const props = defaultProps();
		props.activeTab = "plugins";
		const { findAllByRole } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		const checkboxes = await findAllByRole("checkbox");
		expect(checkboxes).toHaveLength(2);
		expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
		expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
	});

	it("shows default path as placeholder when not customized", async () => {
		setupMockRPC({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [makePlugin({ isCustomDir: false, defaultDataDir: "/Users/test/.claude" })],
				}),
		});
		const props = defaultProps();
		props.activeTab = "plugins";
		const { findByPlaceholderText } = render(<SettingsView {...props} />, {
			wrapper: MockProviders,
		});
		const input = await findByPlaceholderText("/Users/test/.claude");
		expect((input as HTMLInputElement).value).toBe("");
	});

	it("shows custom path as value when customized", async () => {
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
		const { findByDisplayValue } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		expect(await findByDisplayValue("/custom/path")).toBeTruthy();
	});

	it("shows Reset link when path is customized", async () => {
		setupMockRPC({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [makePlugin({ isCustomDir: true, dataDir: "/custom/path" })],
				}),
		});
		const props = defaultProps();
		props.activeTab = "plugins";
		const { findByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		expect(await findByText("Reset")).toBeTruthy();
	});

	it("does not show Reset link for default path", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin({ isCustomDir: false })] }),
		});
		const props = defaultProps();
		props.activeTab = "plugins";
		const { findByText, queryByText } = render(<SettingsView {...props} />, {
			wrapper: MockProviders,
		});
		await findByText("Claude Code");
		expect(queryByText("Reset")).toBeNull();
	});

	it("General tab reflects persisted value", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
		});
		const { findByLabelText } = render(<SettingsView {...defaultProps()} />, {
			wrapper: MockProviders,
		});
		const checkbox = await findByLabelText("Show security warning on startup");
		expect((checkbox as HTMLInputElement).checked).toBe(false);
	});

	it("General tab shows Global and Presentation subsections", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { findByText } = render(<SettingsView {...defaultProps()} />, { wrapper: MockProviders });
		expect(await findByText("Global")).toBeTruthy();
		expect(await findByText("Presentation")).toBeTruthy();
	});

	it("General tab shows theme selector with System/Light/Dark options", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		const { findAllByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		// Both global and presentation have these options
		const systemButtons = await findAllByText("System");
		expect(systemButtons.length).toBeGreaterThanOrEqual(2);
	});

	it("theme selector calls set when option clicked", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		const { findAllByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		const [darkButton] = await findAllByText("Dark");
		// First Dark button is in Global section
		fireEvent.click(darkButton as HTMLElement);
		expect(props.theme.set).toHaveBeenCalledWith("dark");
	});

	it("font size controls call increase/decrease", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		const { findAllByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		const [plusButton] = await findAllByText("A+");
		const [minusButton] = await findAllByText("A-");
		fireEvent.click(plusButton as HTMLElement);
		expect(props.fontSize.increase).toHaveBeenCalled();
		fireEvent.click(minusButton as HTMLElement);
		expect(props.fontSize.decrease).toHaveBeenCalled();
	});

	it("presentation theme selector is disabled when sameAsGlobal is true", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		props.presentationTheme.sameAsGlobal = true;
		const { container, findByText } = render(<SettingsView {...props} />, {
			wrapper: MockProviders,
		});
		await findByText("Presentation");
		const selectors = container.querySelectorAll(".settings-theme-selector");
		// Second selector is presentation
		expect(selectors[1]?.classList.contains("disabled")).toBe(true);
	});

	it("presentation theme selector is enabled when sameAsGlobal is false", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		props.presentationTheme.sameAsGlobal = false;
		const { container, findByText } = render(<SettingsView {...props} />, {
			wrapper: MockProviders,
		});
		await findByText("Presentation");
		const selectors = container.querySelectorAll(".settings-theme-selector");
		expect(selectors[1]?.classList.contains("disabled")).toBe(false);
	});

	it("presentation font-size control is disabled when sameAsGlobal is true", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		props.presentationFontSize.sameAsGlobal = true;
		const { container, findByText } = render(<SettingsView {...props} />, {
			wrapper: MockProviders,
		});
		await findByText("Presentation");
		const controls = container.querySelectorAll(".settings-font-size-control");
		expect(controls[1]?.classList.contains("disabled")).toBe(true);
	});

	it("Same as global checkboxes are rendered", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { findAllByLabelText } = render(<SettingsView {...defaultProps()} />, {
			wrapper: MockProviders,
		});
		const sameLabels = await findAllByLabelText("Same as global");
		expect(sameLabels).toHaveLength(2);
	});

	it("unchecking Same as global calls setSameAsGlobal(false)", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		const { findAllByLabelText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		const [themeLabel, fontSizeLabel] = await findAllByLabelText("Same as global");
		// First is theme, second is font size
		fireEvent.click(themeLabel as HTMLElement);
		expect(props.presentationTheme.setSameAsGlobal).toHaveBeenCalledWith(false);
		fireEvent.click(fontSizeLabel as HTMLElement);
		expect(props.presentationFontSize.setSameAsGlobal).toHaveBeenCalledWith(false);
	});

	it("General tab shows font size value", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const props = defaultProps();
		props.fontSize.size = 20;
		const { findByText } = render(<SettingsView {...props} />, { wrapper: MockProviders });
		expect(await findByText("20")).toBeTruthy();
	});

	it("General tab shows Reset to defaults button", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { findByRole } = render(<SettingsView {...defaultProps()} />, { wrapper: MockProviders });
		const btn = await findByRole("button", { name: "Reset to defaults" });
		expect(btn).toBeDefined();
	});

	it("General tab shows Updates section with channel selector", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
			hostBridge: {
				getUpdateSettings: () =>
					Promise.resolve({
						channel: "stable" as const,
						checkIntervalHours: 6,
						autoDownload: true,
					}),
			},
		});
		const { findByText } = render(<SettingsView {...defaultProps()} />, { wrapper: MockProviders });
		expect(await findByText("Updates")).toBeTruthy();
		expect(await findByText("Update Channel")).toBeTruthy();
	});

	it("General tab shows current update channel selection", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
			hostBridge: {
				getUpdateSettings: () =>
					Promise.resolve({ channel: "beta" as const, checkIntervalHours: 6, autoDownload: true }),
			},
		});
		const { findByDisplayValue } = render(<SettingsView {...defaultProps()} />, {
			wrapper: MockProviders,
		});
		expect(await findByDisplayValue("Beta")).toBeTruthy();
	});

	it("General tab shows Check now button", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
			hostBridge: {
				getUpdateSettings: () =>
					Promise.resolve({
						channel: "stable" as const,
						checkIntervalHours: 6,
						autoDownload: true,
					}),
			},
		});
		const { findByRole } = render(<SettingsView {...defaultProps()} />, { wrapper: MockProviders });
		expect(await findByRole("button", { name: "Check now" })).toBeTruthy();
	});
});

describe("SettingsSidebar", () => {
	afterEach(cleanup);

	it("renders General and Plugins buttons", () => {
		const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => undefined} />, {
			wrapper: MockProviders,
		});
		expect(getByRole("button", { name: "General" })).toBeDefined();
		expect(getByRole("button", { name: "Plugins" })).toBeDefined();
	});

	it("marks General as active when activeTab is general", () => {
		const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => undefined} />, {
			wrapper: MockProviders,
		});
		expect(getByRole("button", { name: "General" }).classList.contains("active")).toBe(true);
		expect(getByRole("button", { name: "Plugins" }).classList.contains("active")).toBe(false);
	});

	it("marks Plugins as active when activeTab is plugins", () => {
		const { getByRole } = render(<SettingsSidebar activeTab="plugins" onTabChange={() => undefined} />, {
			wrapper: MockProviders,
		});
		expect(getByRole("button", { name: "General" }).classList.contains("active")).toBe(false);
		expect(getByRole("button", { name: "Plugins" }).classList.contains("active")).toBe(true);
	});

	it("calls onTabChange when clicking a tab", () => {
		const onTabChange = mock();
		const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={onTabChange} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Plugins" }));
		expect(onTabChange).toHaveBeenCalledWith("plugins");
	});

	it("renders back button when onBack provided", () => {
		const onBack = mock();
		const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => undefined} onBack={onBack} />, {
			wrapper: MockProviders,
		});
		expect(getByRole("button", { name: "Back" })).toBeDefined();
	});

	it("calls onBack when back button clicked", () => {
		const onBack = mock();
		const { getByRole } = render(<SettingsSidebar activeTab="general" onTabChange={() => undefined} onBack={onBack} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Back" }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});
