import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { AppGate } from "./App";
import { MockProviders, setMockHostConnectionState, setupMockRpc } from "./test-helpers/mock-rpc";

describe("AppGate", () => {
	const originalError = console.error;

	beforeEach(() => {
		console.error = (...args: unknown[]) => {
			const message = args.map(String).join(" ");
			if (message.includes("not wrapped in act")) {
				return;
			}
			originalError(...args);
		};
	});

	afterEach(() => {
		cleanup();
		console.error = originalError;
	});

	async function clickAndFlush(button: HTMLElement): Promise<void> {
		await act(async () => {
			fireEvent.click(button);
			await Promise.resolve();
		});
	}

	// --- First launch (isFirstLaunch=true): show full Onboarding ---

	it("shows full onboarding on first launch", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	it("first launch: completing onboarding shows App", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
			acceptRisks: () => Promise.resolve({ ok: true }),
			getPluginSettings: () => Promise.resolve({ plugins: [] }),
		});
		const { findByRole, findByText } = render(<AppGate />, { wrapper: MockProviders });
		const nextBtn = await findByRole("button", { name: "Accept & Continue" });
		act(() => {
			fireEvent.click(nextBtn);
		});
		const startBtn = await findByRole("button", { name: "Get Started" });
		await clickAndFlush(startBtn);
		expect(await findByText("Welcome to Klovi")).toBeTruthy();
	});

	it("first launch: does not disable warning unless checkbox is checked", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
			updateGeneralSettings: updateGeneralSettings,
			getPluginSettings: () => Promise.resolve({ plugins: [] }),
		});
		const { findByRole } = render(<AppGate />, { wrapper: MockProviders });
		const nextBtn = await findByRole("button", { name: "Accept & Continue" });
		act(() => {
			fireEvent.click(nextBtn);
		});
		const startBtn = await findByRole("button", { name: "Get Started" });
		act(() => {
			fireEvent.click(startBtn);
		});
		expect(updateGeneralSettings).not.toHaveBeenCalled();
	});

	it("first launch: checking dont-show in step 1 saves setting", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
			updateGeneralSettings: updateGeneralSettings,
			getPluginSettings: () => Promise.resolve({ plugins: [] }),
		});
		const { findByRole, findByLabelText } = render(<AppGate />, { wrapper: MockProviders });
		const checkbox = await findByLabelText("Don't show this again");
		act(() => {
			fireEvent.click(checkbox);
		});
		const nextBtn = await findByRole("button", { name: "Accept & Continue" });
		act(() => {
			fireEvent.click(nextBtn);
		});
		expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
	});

	// --- Returning user + showSecurityWarning=true: show SecurityWarning ---

	it("returning user with warning enabled sees security warning", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		});
		const { findByRole } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	it("returning user: Accept & Continue shows App", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
			acceptRisks: () => Promise.resolve({ ok: true }),
		});
		const { findByRole, findByText } = render(<AppGate />, { wrapper: MockProviders });
		const btn = await findByRole("button", { name: "Accept & Continue" });
		await clickAndFlush(btn);
		expect(await findByText("Welcome to Klovi")).toBeTruthy();
	});

	it("returning user: checking dont-show saves setting", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
			acceptRisks: () => Promise.resolve({ ok: true }),
			updateGeneralSettings: updateGeneralSettings,
		});
		const { findByRole, findByLabelText } = render(<AppGate />, { wrapper: MockProviders });
		const checkbox = await findByLabelText("Don't show this again");
		act(() => {
			fireEvent.click(checkbox);
		});
		const btn = await findByRole("button", { name: "Accept & Continue" });
		act(() => {
			fireEvent.click(btn);
		});
		expect(updateGeneralSettings).toHaveBeenCalledWith({ showSecurityWarning: false });
	});

	// --- Returning user + showSecurityWarning=false: skip straight to App ---

	it("returning user with warning disabled skips to App", async () => {
		const acceptRisks = mock(() => Promise.resolve({ ok: true }));
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
			acceptRisks: acceptRisks,
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		await findByText("Welcome to Klovi");
		expect(acceptRisks).toHaveBeenCalledTimes(1);
	});

	// --- Error handling ---

	it("shows onboarding when isFirstLaunch fails", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.reject(new Error("RPC failed")),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	it("shows onboarding when getGeneralSettings fails for returning user", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.reject(new Error("RPC failed")),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	it("App renders even if acceptRisks RPC fails", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
			acceptRisks: () => Promise.reject(new Error("RPC failed")),
			getPluginSettings: () => Promise.resolve({ plugins: [] }),
		});
		const { findByRole, findByText } = render(<AppGate />, { wrapper: MockProviders });
		const nextBtn = await findByRole("button", { name: "Accept & Continue" });
		act(() => {
			fireEvent.click(nextBtn);
		});
		const startBtn = await findByRole("button", { name: "Get Started" });
		await clickAndFlush(startBtn);
		expect(await findByText("Welcome to Klovi")).toBeTruthy();
	});

	it("shows desktop reconnect state on transport failure instead of onboarding", async () => {
		setupMockRpc({
			isFirstLaunch: () => Promise.reject(new Error("RPC request timed out.")),
		});

		const { findByText, queryByText } = render(<AppGate />, { wrapper: MockProviders });

		expect(await findByText("Connecting to Klovi desktop host...")).toBeTruthy();
		expect(queryByText("Session Data Notice")).toBeNull();
	});

	it("desktop reconnect screen retries into the app after host recovery", async () => {
		const isFirstLaunch = mock<() => Promise<{ firstLaunch: boolean }>>(() =>
			Promise.reject(new Error("RPC request timed out.")),
		);

		setupMockRpc({
			isFirstLaunch: isFirstLaunch,
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
			acceptRisks: () => Promise.resolve({ ok: true }),
		});

		const { findByRole, findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Connecting to Klovi desktop host...")).toBeTruthy();

		isFirstLaunch.mockImplementation(() => Promise.resolve({ firstLaunch: false }));
		setMockHostConnectionState("connected");

		const retryButton = await findByRole("button", { name: "Retry" });
		await clickAndFlush(retryButton);

		await findByText("Welcome to Klovi");
	});
});
