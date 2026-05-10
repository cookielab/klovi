import { cleanup, render } from "@testing-library/react";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
	afterEach(cleanup);

	it("renders Klovi title", () => {
		const { container } = render(
			<Sidebar>
				<div>Children</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector("h1")?.textContent).toBe("Klovi");
	});

	it("renders children in sidebar-content", () => {
		const { getByText } = render(
			<Sidebar>
				<div>My Child Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(getByText("My Child Content")).toBeTruthy();
	});

	it("renders search button when onSearchClick provided", () => {
		const onSearchClick = mock(() => undefined);
		const { getByTitle } = render(
			<Sidebar onSearchClick={onSearchClick}>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(getByTitle("Search sessions (Ctrl+K)")).toBeTruthy();
	});

	it("does not render search button when onSearchClick not provided", () => {
		const { container } = render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector("[title='Search sessions (Ctrl+K)']")).toBeNull();
	});

	it("renders version info after fetch", async () => {
		setupMockRPC({
			getVersion: () => Promise.resolve({ version: "1.2.3", commit: "abc1234" }),
		});

		const { findByText } = render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		const versionBadge = await findByText("1.2.3 (abc1234)");
		expect(versionBadge.classList.contains("sidebar-version")).toBe(true);
		expect(versionBadge.className).toContain("bg-surface-sunken");
	});

	it("renders version without commit hash when empty", async () => {
		setupMockRPC({
			getVersion: () => Promise.resolve({ version: "1.2.3", commit: "" }),
		});

		const { findByText } = render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(await findByText("1.2.3")).toBeTruthy();
	});

	it("renders settings button when onSettingsClick provided", () => {
		const onSettingsClick = mock(() => undefined);
		const { getByTitle } = render(
			<Sidebar onSettingsClick={onSettingsClick}>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(getByTitle("Settings (Ctrl+,)")).toBeTruthy();
	});

	it("does not render settings button when onSettingsClick not provided", () => {
		const { container } = render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector("[title='Settings (Ctrl+,)']")).toBeNull();
	});

	it("renders footer with cookielab link", () => {
		const { container } = render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
			{ wrapper: MockProviders },
		);
		const footer = container.querySelector(".sidebar-footer");
		expect(footer).not.toBeNull();
		expect(footer?.textContent).toContain("cookielab.io");
	});
});
