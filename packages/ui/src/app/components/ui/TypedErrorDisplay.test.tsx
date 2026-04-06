import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { RpcDisconnectedError, RpcHandlerError, RpcTimeoutError } from "../../../lib/rpc-errors-effect.ts";
import { TypedErrorDisplay } from "./TypedErrorDisplay.tsx";

const RETRY_REGEX = /retry/iu;

function noop(): void {}

describe("TypedErrorDisplay", () => {
	afterEach(() => cleanup());

	test("renders timeout error with title", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: 30_000 });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Request timed out")).toBeTruthy();
	});

	test("renders disconnected error", () => {
		const error = new RpcDisconnectedError({ method: "getSession" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Connection lost")).toBeTruthy();
	});

	test("renders handler error with reason", () => {
		const error = new RpcHandlerError({ method: "getStats", reason: "Database unavailable" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Database unavailable")).toBeTruthy();
	});

	test("renders retry button when onRetry provided", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: 30_000 });
		const { getByRole } = render(<TypedErrorDisplay error={error} onRetry={noop} />);
		expect(getByRole("button", { name: RETRY_REGEX })).toBeTruthy();
	});

	test("does not render retry button when onRetry omitted", () => {
		const error = new RpcHandlerError({ method: "test", reason: "fail" });
		const { queryByRole } = render(<TypedErrorDisplay error={error} />);
		expect(queryByRole("button")).toBeNull();
	});
});
