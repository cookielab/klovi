import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning";

const SENSITIVE_INFO_REGEX = /sensitive information/u;
const FULLY_LOCAL_REGEX = /fully local/u;

describe("SecurityWarning", () => {
	afterEach(cleanup);

	it("renders Session Data Notice heading", () => {
		const { getByText } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(getByText("Session Data Notice")).toBeTruthy();
	});

	it("renders sensitive information text", () => {
		const { getByText } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(getByText(SENSITIVE_INFO_REGEX)).toBeTruthy();
	});

	it("renders fully local text", () => {
		const { getByText } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(getByText(FULLY_LOCAL_REGEX)).toBeTruthy();
	});

	it("renders Accept & Continue button", () => {
		const { getByRole } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	it("renders Don't show this again checkbox", () => {
		const { getByLabelText } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(getByLabelText("Don't show this again")).toBeTruthy();
	});

	it("clicking Accept & Continue calls onAccept", () => {
		const onAccept = mock(() => undefined);
		const { getByRole } = render(<SecurityWarning onAccept={onAccept} onDontShowAgain={() => undefined} />);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	it("checking checkbox and clicking Accept calls onDontShowAgain", () => {
		const onDontShowAgain = mock(() => undefined);
		const onAccept = mock(() => undefined);
		const { getByRole, getByLabelText } = render(
			<SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
		);
		fireEvent.click(getByLabelText("Don't show this again"));
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onDontShowAgain).toHaveBeenCalledTimes(1);
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	it("clicking Accept without checkbox does not call onDontShowAgain", () => {
		const onDontShowAgain = mock(() => undefined);
		const onAccept = mock(() => undefined);
		const { getByRole } = render(<SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onDontShowAgain).not.toHaveBeenCalled();
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	it("renders Klovi logo", () => {
		const { container } = render(<SecurityWarning onAccept={() => undefined} onDontShowAgain={() => undefined} />);
		expect(container.querySelector(".security-warning-logo")).not.toBeNull();
	});
});
