import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message);
}

function SafeComponent() {
  return <div>Safe content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console.error noise
  const originalError = console.error;
  beforeEach(() => {
    console.error = (...args: unknown[]) => {
      const msg = String(args[0]);
      if (msg.includes("Error: Uncaught") || msg.includes("The above error")) return;
      originalError(...args);
    };
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
    const { getByText, container } = render(
      <ErrorBoundary inline>
        <ThrowingComponent message="render failure" />
      </ErrorBoundary>,
    );
    expect(container.querySelector(".error-card")).not.toBeNull();
    expect(getByText("Failed to render")).toBeTruthy();
    expect(getByText("Retry")).toBeTruthy();
    expect(getByText("Error details")).toBeTruthy();
  });

  test("retry resets error state on view-level boundary", () => {
    let shouldThrow = true;
    function MaybeThrow(): React.JSX.Element {
      if (shouldThrow) throw new Error("boom");
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
    let shouldThrow = true;
    function MaybeThrow(): React.JSX.Element {
      if (shouldThrow) throw new Error("boom");
      return <div>Recovered inline</div>;
    }

    const { getByText } = render(
      <ErrorBoundary inline>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(getByText("Failed to render")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(getByText("Retry"));
    expect(getByText("Recovered inline")).toBeTruthy();
  });
});
