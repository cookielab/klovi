import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ErrorBoundary } from "@cookielab.io/klovi-ui-components/utilities";
import { cleanup, fireEvent, render } from "@testing-library/react";

// biome-ignore lint/style/useComponentExportOnlyModules: test helper component
function ThrowingComponent({ message }: { message: string }): never {
	throw new Error(message);
}

// biome-ignore lint/style/useComponentExportOnlyModules: test helper component
function SafeComponent() {
	return <div>Safe content</div>;
}

describe("ErrorBoundary", () => {
	// biome-ignore lint/suspicious/noConsole: test-only console stubbing
	const originalError = console.error;

	function silenceExpectedBoundaryErrors(): void {
		console.error = () => {};
	}

	beforeEach(() => {
		console.error = originalError;
	});
	afterEach(() => {
		cleanup();
		console.error = originalError;
	});

	test("renders children when no error", () => {
		const { getByText } = render(
			<ErrorBoundary>
				<SafeComponent />
			</ErrorBoundary>,
		);
		expect(getByText("Safe content")).toBeTruthy();
	});

	test("renders view-level fallback on error", () => {
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

	test("renders inline fallback on error when inline=true", () => {
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

	test("retry resets error state on view-level boundary", () => {
		silenceExpectedBoundaryErrors();
		let shouldThrow = true;
		function MaybeThrow(): React.JSX.Element {
			// biome-ignore lint/nursery/noUnnecessaryConditions: value is mutated between renders in test
			if (shouldThrow) {
				throw new Error("boom");
			}
			return <div>Recovered</div>;
		}

		const { getByText } = render(
			<ErrorBoundary>
				<MaybeThrow />
			</ErrorBoundary>,
		);
		expect(getByText("Something went wrong")).toBeTruthy();

		shouldThrow = false;
		fireEvent.click(getByText("Try Again"));
		expect(getByText("Recovered")).toBeTruthy();
	});

	test("retry resets error state on inline boundary", () => {
		silenceExpectedBoundaryErrors();
		let shouldThrow = true;
		function MaybeThrow(): React.JSX.Element {
			// biome-ignore lint/nursery/noUnnecessaryConditions: value is mutated between renders in test
			if (shouldThrow) {
				throw new Error("boom");
			}
			return <div>Recovered inline</div>;
		}

		const { getByText } = render(
			<ErrorBoundary inline={true}>
				<MaybeThrow />
			</ErrorBoundary>,
		);
		expect(getByText("Failed to render")).toBeTruthy();

		shouldThrow = false;
		fireEvent.click(getByText("Retry"));
		expect(getByText("Recovered inline")).toBeTruthy();
	});
});
