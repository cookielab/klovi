import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { Onboarding } from "./Onboarding.tsx";

const SENSITIVE_INFO_REGEX = /sensitive information/u;
const FULLY_LOCAL_REGEX = /fully local/u;

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
		const { getByText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		expect(getByText("Session Data Notice")).toBeTruthy();
		expect(getByText(SENSITIVE_INFO_REGEX)).toBeTruthy();
		expect(getByText(FULLY_LOCAL_REGEX)).toBeTruthy();
	});

	test("renders Accept & Continue button on step 1", () => {
		setupMockRPC();
		const { getByRole } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	test("renders Don't show this again checkbox on step 1", () => {
		setupMockRPC();
		const { getByLabelText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		expect(getByLabelText("Don't show this again")).toBeTruthy();
	});

	test("does not show Get Started on step 1", () => {
		setupMockRPC();
		const { queryByRole } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		expect(queryByRole("button", { name: "Get Started" })).toBeNull();
	});

	test("clicking Accept & Continue shows step 2 with plugins", async () => {
		setupMockRPC({
			getPluginSettings: () =>
				Promise.resolve({
					plugins: [
						makePlugin({ id: "claude-code", displayName: "Claude Code" }),
						makePlugin({ id: "codex-cli", displayName: "Codex CLI" }),
					],
				}),
		});
		const { getByRole, findByText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(await findByText("Plugins")).toBeTruthy();
		expect(await findByText("Claude Code")).toBeTruthy();
		expect(await findByText("Codex CLI")).toBeTruthy();
	});

	test("step 2 shows Get Started button", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { getByRole, findByRole } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(await findByRole("button", { name: "Get Started" })).toBeTruthy();
	});

	test("Get Started calls onComplete", async () => {
		const onComplete = mock(() => {});
		setupMockRPC({
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

	test("Back button on step 2 returns to step 1", async () => {
		setupMockRPC({
			getPluginSettings: () => Promise.resolve({ plugins: [makePlugin()] }),
		});
		const { getByRole, findByRole, findByText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		await findByText("Plugins");
		const backBtn = await findByRole("button", { name: "Back" });
		fireEvent.click(backBtn);
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	test("checking Don't show this again and accepting calls updateGeneralSettings", () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRPC({ updateGeneralSettings: updateGeneralSettings });
		const { getByRole, getByLabelText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		fireEvent.click(getByLabelText("Don't show this again"));
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(updateGeneralSettings).toHaveBeenCalledTimes(1);
	});

	test("renders step indicator dots", () => {
		setupMockRPC();
		const { container } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		const dots = container.querySelectorAll(".onboarding-dot");
		expect(dots).toHaveLength(2);
	});

	test("renders Klovi logo on step 1", () => {
		setupMockRPC();
		const { container } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<Onboarding onComplete={() => {}} />,
			{ wrapper: MockProviders },
		);
		const img = container.querySelector(".security-warning-logo");
		expect(img).not.toBeNull();
	});
});
