import { cleanup, render } from "@testing-library/react";
import { MockProviders } from "../../test-helpers/mock-rpc";
import { Layout } from "./Layout";

afterEach(cleanup);

describe("Layout", () => {
	it("renders sidebar content", () => {
		const { getByText } = render(
			<Layout sidebar={<div>Sidebar Content</div>}>
				<div>Main Content</div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(getByText("Sidebar Content")).toBeTruthy();
	});

	it("renders main content", () => {
		const { getByText } = render(
			<Layout sidebar={<div>Sidebar</div>}>
				<div>Main Content</div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(getByText("Main Content")).toBeTruthy();
	});

	it("applies sidebar-hidden class when hideSidebar is true", () => {
		const { container } = render(
			<Layout sidebar={<div>Sidebar</div>} hideSidebar={true}>
				<div>Content</div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".app-layout.sidebar-hidden")).not.toBeNull();
	});

	it("does not apply sidebar-hidden class by default", () => {
		const { container } = render(
			<Layout sidebar={<div>Sidebar</div>}>
				<div>Content</div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".sidebar-hidden")).toBeNull();
	});

	it("has main-content wrapper", () => {
		const { container } = render(
			<Layout sidebar={<div>Sidebar</div>}>
				<div>Content</div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".main-content")).not.toBeNull();
	});
});
