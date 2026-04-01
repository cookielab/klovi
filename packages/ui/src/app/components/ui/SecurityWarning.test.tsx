import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SecurityWarning } from "./SecurityWarning.tsx";

const SENSITIVE_INFO_REGEX = /sensitive information/u;
const FULLY_LOCAL_REGEX = /fully local/u;

describe("SecurityWarning", () => {
	afterEach(cleanup);

	test("renders Session Data Notice heading", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByText } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(getByText("Session Data Notice")).toBeTruthy();
	});

	test("renders sensitive information text", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByText } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(getByText(SENSITIVE_INFO_REGEX)).toBeTruthy();
	});

	test("renders fully local text", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByText } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(getByText(FULLY_LOCAL_REGEX)).toBeTruthy();
	});

	test("renders Accept & Continue button", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByRole } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(getByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	test("renders Don't show this again checkbox", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByLabelText } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(getByLabelText("Don't show this again")).toBeTruthy();
	});

	test("clicking Accept & Continue calls onAccept", () => {
		const onAccept = mock(() => {});
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { getByRole } = render(<SecurityWarning onAccept={onAccept} onDontShowAgain={() => {}} />);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	test("checking checkbox and clicking Accept calls onDontShowAgain", () => {
		const onDontShowAgain = mock(() => {});
		const onAccept = mock(() => {});
		const { getByRole, getByLabelText } = render(
			<SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />,
		);
		fireEvent.click(getByLabelText("Don't show this again"));
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onDontShowAgain).toHaveBeenCalledTimes(1);
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	test("clicking Accept without checkbox does not call onDontShowAgain", () => {
		const onDontShowAgain = mock(() => {});
		const onAccept = mock(() => {});
		const { getByRole } = render(<SecurityWarning onAccept={onAccept} onDontShowAgain={onDontShowAgain} />);
		fireEvent.click(getByRole("button", { name: "Accept & Continue" }));
		expect(onDontShowAgain).not.toHaveBeenCalled();
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	test("renders Klovi logo", () => {
		// biome-ignore lint/nursery/noJsxPropsBind: test render prop
		const { container } = render(<SecurityWarning onAccept={() => {}} onDontShowAgain={() => {}} />);
		expect(container.querySelector(".security-warning-logo")).not.toBeNull();
	});
});
