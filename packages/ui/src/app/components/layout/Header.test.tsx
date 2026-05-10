import { cleanup, fireEvent, render } from "@testing-library/react";
import { Header } from "./Header";

afterEach(cleanup);

function makeProps(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
	return {
		title: "Test Session",
		presentationActive: false,
		onTogglePresentation: mock(() => undefined),
		showPresentationToggle: false,
		...overrides,
	};
}

describe("Header", () => {
	it("renders title", () => {
		const { container } = render(<Header {...makeProps()} />);
		expect(container.querySelector(".header-title")?.textContent).toContain("Test Session");
	});

	it("renders breadcrumb when provided", () => {
		const { container } = render(<Header {...makeProps({ breadcrumb: "My Project" })} />);
		expect(container.textContent).toContain("My Project");
	});

	it("does not render breadcrumb when not provided", () => {
		const { container } = render(<Header {...makeProps()} />);
		expect(container.textContent).not.toContain("/\u00a0");
	});

	it("renders back link when backHref provided", () => {
		const { container } = render(<Header {...makeProps({ backHref: "#/back" })} />);
		const backBtn = container.querySelector(".back-btn") as HTMLAnchorElement;
		expect(backBtn).not.toBeNull();
		expect(backBtn.href).toContain("#/back");
	});

	it("renders session type badge for plan", () => {
		const { container } = render(<Header {...makeProps({ sessionType: "plan" })} />);
		const badge = container.querySelector(".session-type-badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent).toBe("Plan");
		expect(badge?.classList.contains("plan")).toBe(true);
	});

	it("renders session type badge for implementation", () => {
		const { container } = render(<Header {...makeProps({ sessionType: "implementation" })} />);
		const badge = container.querySelector(".session-type-badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent).toBe("Impl");
	});

	it("does not render session type badge when not provided", () => {
		const { container } = render(<Header {...makeProps()} />);
		expect(container.querySelector(".session-type-badge")).toBeNull();
	});

	it("renders copy button when copyCommand provided", () => {
		const { container } = render(<Header {...makeProps({ copyCommand: "claude --resume abc123" })} />);
		const copyBtn = container.querySelector(".btn-copy-command");
		expect(copyBtn).not.toBeNull();
	});

	it("does not render copy button when no copyCommand", () => {
		const { container } = render(<Header {...makeProps()} />);
		expect(container.querySelector(".btn-copy-command")).toBeNull();
	});

	it("shows presentation toggle when showPresentationToggle is true", () => {
		const { getByText } = render(<Header {...makeProps({ showPresentationToggle: true })} />);
		expect(getByText("Present")).toBeTruthy();
	});

	it("hides presentation toggle when showPresentationToggle is false", () => {
		const { container } = render(<Header {...makeProps({ showPresentationToggle: false })} />);
		expect(container.textContent).not.toContain("Present");
	});

	it("shows Exit Presentation when presentationActive", () => {
		const { getByText } = render(<Header {...makeProps({ showPresentationToggle: true, presentationActive: true })} />);
		expect(getByText("Exit Presentation")).toBeTruthy();
	});

	it("calls onTogglePresentation when presentation button clicked", () => {
		const onTogglePresentation = mock(() => undefined);
		const { getByText } = render(
			<Header {...makeProps({ showPresentationToggle: true, onTogglePresentation: onTogglePresentation })} />,
		);
		fireEvent.click(getByText("Present"));
		expect(onTogglePresentation).toHaveBeenCalledTimes(1);
	});
});
