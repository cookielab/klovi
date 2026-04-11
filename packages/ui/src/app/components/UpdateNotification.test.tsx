import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { UpdateStatus } from "../../shared/rpc-types.ts";
import { MockProviders, setupMockRPC } from "../test-helpers/mock-rpc.ts";
import { UpdateNotification } from "./UpdateNotification.tsx";

const VERSION_READY_PATTERN = /v2\.0\.0 is ready/u;
const EXTRACT_FAILED_PATTERN = /Extract failed/u;
const UPDATE_FAILED_PATTERN = /Update failed/u;
const NETWORK_TIMEOUT_PATTERN = /Network timeout/u;

function defaultProps() {
	return {
		status: { status: "up-to-date", currentVersion: "1.0.0" } as UpdateStatus,
		dismissed: false,
		onDismiss: mock(),
		manualCheckResult: null as UpdateStatus | null,
		onDismissManualCheck: mock(),
	};
}

describe("UpdateNotification", () => {
	afterEach(cleanup);

	test("renders nothing when status is up-to-date", () => {
		const { container } = render(<UpdateNotification {...defaultProps()} />, {
			wrapper: MockProviders,
		});
		expect(container.innerHTML).toBe("");
	});

	test("renders nothing when dismissed", () => {
		setupMockRPC();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		props.dismissed = true;
		const { container } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(container.innerHTML).toBe("");
	});

	test("renders notification when status is ready", () => {
		setupMockRPC();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText(VERSION_READY_PATTERN)).toBeDefined();
	});

	test("renders Restart button when ready", () => {
		setupMockRPC();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByRole("button", { name: "Restart to update" })).toBeDefined();
	});

	test("calls onDismiss when dismiss button clicked", () => {
		setupMockRPC();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByLabelText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByLabelText("Dismiss"));
		expect(props.onDismiss).toHaveBeenCalled();
	});

	test("calls applyUpdate RPC when Restart clicked", () => {
		const applyUpdate = mock(() => Promise.resolve({ ok: true }));
		setupMockRPC({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		return waitFor(() => {
			expect(applyUpdate).toHaveBeenCalled();
		});
	});

	test("shows Restarting text and disables button while applying", () => {
		const applyUpdate = mock(() => new Promise<{ ok: boolean }>(() => {})); // never resolves
		setupMockRPC({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		const button = getByRole("button", { name: "Restarting…" });
		expect(button).toBeDefined();
		expect(button.hasAttribute("disabled")).toBe(true);
	});

	test("shows error when applyUpdate returns ok: false", async () => {
		const applyUpdate = mock(() => Promise.resolve({ ok: false, error: "Extract failed" }));
		setupMockRPC({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole, getByText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		await waitFor(() => {
			expect(getByText(EXTRACT_FAILED_PATTERN)).toBeDefined();
		});
		// Button should be re-enabled after error
		expect(getByRole("button", { name: "Restart to update" }).hasAttribute("disabled")).toBe(false);
	});

	test("shows error when applyUpdate rejects", async () => {
		const applyUpdate = mock(() => Promise.reject(new Error("RPC error")));
		setupMockRPC({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole, getByText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		await waitFor(() => {
			expect(getByText(UPDATE_FAILED_PATTERN)).toBeDefined();
		});
	});

	test("shows up-to-date message for manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = { status: "up-to-date", currentVersion: "1.0.0" };
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText("You're up to date")).toBeDefined();
	});

	test("shows error message for manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = {
			status: "error",
			currentVersion: "1.0.0",
			error: "Network timeout",
		};
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText(NETWORK_TIMEOUT_PATTERN)).toBeDefined();
	});

	test("calls onDismissManualCheck when dismissing manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = { status: "up-to-date", currentVersion: "1.0.0" };
		const { getByLabelText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByLabelText("Dismiss"));
		expect(props.onDismissManualCheck).toHaveBeenCalled();
	});

	test("manual check result with ready status falls through to normal notification", () => {
		setupMockRPC();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		props.manualCheckResult = {
			status: "ready",
			currentVersion: "1.0.0",
			latestVersion: "2.0.0",
		};
		const { getByText, getByRole } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		expect(getByText(VERSION_READY_PATTERN)).toBeDefined();
		expect(getByRole("button", { name: "Restart to update" })).toBeDefined();
	});
});
