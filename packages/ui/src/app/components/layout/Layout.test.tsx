import { Text } from "@cookielab.io/klovi-design-system";
import { cleanup, render } from "@testing-library/react";
import { MockProviders } from "../../test-helpers/mock-rpc";
import { Layout } from "./Layout";


const T_SIDEBAR_CONTENT = "Sidebar Content";
const T_MAIN_CONTENT = "Main Content";
const T_SIDEBAR = "Sidebar";
const T_CONTENT = "Content";

afterEach(cleanup);

describe("Layout", () => {
	it("renders sidebar content", () => {
		const { getByText } = render(
			<Layout sidebar={<div><Text>{T_SIDEBAR_CONTENT}</Text></div>}>
				<div><Text>{T_MAIN_CONTENT}</Text></div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(getByText("Sidebar Content")).toBeTruthy();
	});

	it("renders main content", () => {
		const { getByText } = render(
			<Layout sidebar={<div><Text>{T_SIDEBAR}</Text></div>}>
				<div><Text>{T_MAIN_CONTENT}</Text></div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(getByText("Main Content")).toBeTruthy();
	});

	it("applies sidebar-hidden class when hideSidebar is true", () => {
		const { container } = render(
			<Layout sidebar={<div><Text>{T_SIDEBAR}</Text></div>} hideSidebar={true}>
				<div><Text>{T_CONTENT}</Text></div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".app-layout.sidebar-hidden")).not.toBeNull();
	});

	it("does not apply sidebar-hidden class by default", () => {
		const { container } = render(
			<Layout sidebar={<div><Text>{T_SIDEBAR}</Text></div>}>
				<div><Text>{T_CONTENT}</Text></div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".sidebar-hidden")).toBeNull();
	});

	it("has main-content wrapper", () => {
		const { container } = render(
			<Layout sidebar={<div><Text>{T_SIDEBAR}</Text></div>}>
				<div><Text>{T_CONTENT}</Text></div>
			</Layout>,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".main-content")).not.toBeNull();
	});
});
