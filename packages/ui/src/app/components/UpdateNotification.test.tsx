import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { UpdateStatus } from "../../shared/rpc-types";
import { MockProviders, setupMockRpc } from "../test-helpers/mock-rpc";
import { UpdateNotification } from "./UpdateNotification";

const noop = (): undefined => undefined;
const VERSION_READY_PATTERN = /v2\.0\.0 is ready/u;
const EXTRACT_FAILED_PATTERN = /Extract failed/u;
const UPDATE_FAILED_PATTERN = /Update failed/u;
const NETWORK_TIMEOUT_PATTERN = /Network timeout/u;

type DefaultProps = {
	status: UpdateStatus;
	dismissed: boolean;
	onDismiss: ReturnType<typeof mock>;
	manualCheckResult: UpdateStatus | null;
	onDismissManualCheck: ReturnType<typeof mock>;
};

function defaultProps(): DefaultProps {
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

	it("renders nothing when status is up-to-date", () => {
		const { container } = render(<UpdateNotification {...defaultProps()} />, {
			wrapper: MockProviders,
		});
		expect(container.innerHTML).toBe("");
	});

	it("renders nothing when dismissed", () => {
		setupMockRpc();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		props.dismissed = true;
		const { container } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(container.innerHTML).toBe("");
	});

	it("renders notification when status is ready", () => {
		setupMockRpc();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText(VERSION_READY_PATTERN)).toBeDefined();
	});

	it("renders Restart button when ready", () => {
		setupMockRpc();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByRole("button", { name: "Restart to update" })).toBeDefined();
	});

	it("calls onDismiss when dismiss button clicked", () => {
		setupMockRpc();
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByLabelText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByLabelText("Dismiss"));
		expect(props.onDismiss).toHaveBeenCalled();
	});

	it("calls applyUpdate RPC when Restart clicked", () => {
		const applyUpdate = mock(() => Promise.resolve({ ok: true }));
		setupMockRpc({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		return waitFor(() => {
			expect(applyUpdate).toHaveBeenCalled();
		});
	});

	it("shows Restarting text and disables button while applying", () => {
		const applyUpdate = mock(() => new Promise<{ ok: boolean }>(noop)); // never resolves
		setupMockRpc({ hostBridge: { applyUpdate: applyUpdate } });
		const props = defaultProps();
		props.status = { status: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
		const { getByRole } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		fireEvent.click(getByRole("button", { name: "Restart to update" }));
		const button = getByRole("button", { name: "Restarting…" });
		expect(button).toBeDefined();
		expect(button.hasAttribute("disabled")).toBe(true);
	});

	it("shows error when applyUpdate returns ok: false", async () => {
		const applyUpdate = mock(() => Promise.resolve({ ok: false, error: "Extract failed" }));
		setupMockRpc({ hostBridge: { applyUpdate: applyUpdate } });
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

	it("shows error when applyUpdate rejects", async () => {
		const applyUpdate = mock(() => Promise.reject(new Error("RPC error")));
		setupMockRpc({ hostBridge: { applyUpdate: applyUpdate } });
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

	it("shows up-to-date message for manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = { status: "up-to-date", currentVersion: "1.0.0" };
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText("You're up to date")).toBeDefined();
	});

	it("shows error message for manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = {
			status: "error",
			currentVersion: "1.0.0",
			error: "Network timeout",
		};
		const { getByText } = render(<UpdateNotification {...props} />, { wrapper: MockProviders });
		expect(getByText(NETWORK_TIMEOUT_PATTERN)).toBeDefined();
	});

	it("calls onDismissManualCheck when dismissing manual check result", () => {
		const props = defaultProps();
		props.manualCheckResult = { status: "up-to-date", currentVersion: "1.0.0" };
		const { getByLabelText } = render(<UpdateNotification {...props} />, {
			wrapper: MockProviders,
		});
		fireEvent.click(getByLabelText("Dismiss"));
		expect(props.onDismissManualCheck).toHaveBeenCalled();
	});

	it("manual check result with ready status falls through to normal notification", () => {
		setupMockRpc();
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
