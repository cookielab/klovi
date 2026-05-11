import { cleanup, render } from "@testing-library/react";
import { RpcDisconnectedError, RpcHandlerError, RpcTimeoutError } from "../../../lib/rpc-errors-effect";
import { TypedErrorDisplay } from "./TypedErrorDisplay";

const N_30000 = 30_000;

const RETRY_REGEX = /retry/iu;

function noop(): void {
	// intentional no-op
}

describe("TypedErrorDisplay", () => {
	afterEach(() => cleanup());

	it("renders timeout error with title", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: N_30000 });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Request timed out")).toBeTruthy();
	});

	it("renders disconnected error", () => {
		const error = new RpcDisconnectedError({ method: "getSession" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Connection lost")).toBeTruthy();
	});

	it("renders handler error with reason", () => {
		const error = new RpcHandlerError({ method: "getStats", reason: "Database unavailable" });
		const { getByText } = render(<TypedErrorDisplay error={error} />);
		expect(getByText("Database unavailable")).toBeTruthy();
	});

	it("renders retry button when onRetry provided", () => {
		const error = new RpcTimeoutError({ method: "getProjects", timeoutMs: N_30000 });
		const { getByRole } = render(<TypedErrorDisplay error={error} onRetry={noop} />);
		expect(getByRole("button", { name: RETRY_REGEX })).toBeTruthy();
	});

	it("does not render retry button when onRetry omitted", () => {
		const error = new RpcHandlerError({ method: "test", reason: "fail" });
		const { queryByRole } = render(<TypedErrorDisplay error={error} />);
		expect(queryByRole("button")).toBeNull();
	});
});
