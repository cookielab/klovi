import { ErrorBoundary } from "@cookielab.io/klovi-ui-components/utilities";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { T_RECOVERED, T_RECOVERED_INLINE } from "./ErrorBoundary.test.constants";
import { MaybeThrow, SafeComponent, ThrowingComponent } from "./ErrorBoundary.test.helpers";

const noop = (): undefined => undefined;

type ConsoleHolder = { error: (...args: unknown[]) => void };
const consoleHolder: ConsoleHolder = globalThis.console as unknown as ConsoleHolder;

describe("ErrorBoundary", () => {
	const originalError = consoleHolder.error;

	function silenceExpectedBoundaryErrors(): void {
		consoleHolder.error = noop;
	}

	beforeEach(() => {
		consoleHolder.error = originalError;
	});
	afterEach(() => {
		cleanup();
		consoleHolder.error = originalError;
	});

	it("renders children when no error", () => {
		const { getByText } = render(
			<ErrorBoundary>
				<SafeComponent />
			</ErrorBoundary>,
		);
		expect(getByText("Safe content")).toBeTruthy();
	});

	it("renders view-level fallback on error", () => {
		silenceExpectedBoundaryErrors();
		const { getByText } = render(
			<ErrorBoundary>
				<ThrowingComponent message="test crash" />
			</ErrorBoundary>,
		);
		expect(getByText("Something went wrong")).toBeTruthy();
		expect(getByText("test crash")).toBeTruthy();
		expect(getByText("Try Again")).toBeTruthy();
	});

	it("renders inline fallback on error when inline=true", () => {
		silenceExpectedBoundaryErrors();
		const { getByText } = render(
			<ErrorBoundary inline={true}>
				<ThrowingComponent message="render failure" />
			</ErrorBoundary>,
		);
		expect(getByText("Failed to render")).toBeTruthy();
		expect(getByText("Retry")).toBeTruthy();
		expect(getByText("Error details")).toBeTruthy();
	});

	it("retry resets error state on view-level boundary", () => {
		silenceExpectedBoundaryErrors();
		const shouldThrowRef = { current: true };

		const { getByText } = render(
			<ErrorBoundary>
				<MaybeThrow shouldThrowRef={shouldThrowRef} recoveredText={T_RECOVERED} />
			</ErrorBoundary>,
		);
		expect(getByText("Something went wrong")).toBeTruthy();

		shouldThrowRef.current = false;
		fireEvent.click(getByText("Try Again"));
		expect(getByText("Recovered")).toBeTruthy();
	});

	it("retry resets error state on inline boundary", () => {
		silenceExpectedBoundaryErrors();
		const shouldThrowRef = { current: true };

		const { getByText } = render(
			<ErrorBoundary inline={true}>
				<MaybeThrow shouldThrowRef={shouldThrowRef} recoveredText={T_RECOVERED_INLINE} />
			</ErrorBoundary>,
		);
		expect(getByText("Failed to render")).toBeTruthy();

		shouldThrowRef.current = false;
		fireEvent.click(getByText("Retry"));
		expect(getByText("Recovered inline")).toBeTruthy();
	});
});
