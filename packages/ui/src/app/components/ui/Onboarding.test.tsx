import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types";
import { MockProviders, setupMockRpc } from "../../test-helpers/mock-rpc";
import { Onboarding } from "./Onboarding";

const SENSITIVE_INFO_REGEX = /sensitive information/u;
const FULLY_LOCAL_REGEX = /fully local/u;

const noop = (): undefined => undefined;

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

	it("renders step 1 with security notice", () => {
		setupMockRpc();
		const { getByText } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		expect(getByText("Session Data Notice")).toBeTruthy();
		expect(getByText(SENSITIVE_INFO_REGEX)).toBeTruthy();
		expect(getByText(FULLY_LOCAL_REGEX)).toBeTruthy();
	});

	it("renders Accept & Continue button on step 1", () => {
		setupMockRpc();
		const { getByRole } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	it("renders Don't show this again checkbox on step 1", () => {
		setupMockRpc();
		const { getByLabelText } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		expect(getByLabelText("Don't show this again")).toBeTruthy();
	});

	it("does not show Get Started on step 1", () => {
		setupMockRpc();
		const { queryByRole } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		expect(queryByRole("button", { name: "Get Started" })).toBeNull();
	});

	it("clicking Accept & Continue shows step 2 with plugins", async () => {
		setupMockRpc({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [
						makePlugin({ id: "claude-code", displayName: "Claude Code" }),
						makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
					],
				}),
		});
		const { getByRole, findByText } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(await findByText("Plugins")).toBeTruthy();
		expect(await findByText("Claude Code")).toBeTruthy();
		expect(await findByText("Codex CLI")).toBeTruthy();
	});

	it("step 2 shows Get Started button", async () => {
		setupMockRpc({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { getByRole, findByRole } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(await findByRole("button", { name: "Get Started" })).toBeTruthy();
	});

	it("Get Started calls onComplete", async () => {
		const onComplete = mock(noop);
		setupMockRpc({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { getByRole, findByRole } = render(<Onboarding onComplete={onComplete} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		const btn = await findByRole("button", { name: "Get Started" });
		fireEvent.click(btn);
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("Back button on step 2 returns to step 1", async () => {
		setupMockRpc({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { getByRole, findByRole, findByText } = render(<Onboarding onComplete={noop} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		await findByText("Plugins");
		const backBtn = await findByRole("button", { name: "Back" });
		fireEvent.click(backBtn);
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	it("checking Don't show this again and accepting calls updateGeneralSettings", () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRpc({ updateGeneralSettings: updateGeneralSettings });
		const { getByRole, getByLabelText } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		fireEvent.click(getByLabelText("Don't show this again"));
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(updateGeneralSettings).toHaveBeenCalledTimes(1);
	});

	it("renders step indicator dots", () => {
		setupMockRpc();
		const { container } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		const dots = container.querySelectorAll(".onboarding-dot");
		expect(dots).toHaveLength(2);
	});

	it("renders Klovi logo on step 1", () => {
		setupMockRpc();
		const { container } = render(<Onboarding onComplete={noop} />, { wrapper: MockProviders });
		const img = container.querySelector(".security-warning-logo");
		expect(img).not.toBeNull();
	});
});
