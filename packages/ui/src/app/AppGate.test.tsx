import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { AppGate } from "./App.tsx";
import { MockProviders, setMockHostConnectionState, setupMockRPC } from "./test-helpers/mock-rpc.ts";

describe("AppGate", () => {
	// biome-ignore lint/suspicious/noConsole: test-only console filtering
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

	test("shows full onboarding on first launch", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: true }),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	test("first launch: completing onboarding shows App", async () => {
		setupMockRPC({
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

	test("first launch: does not disable warning unless checkbox is checked", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRPC({
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

	test("first launch: checking dont-show in step 1 saves setting", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRPC({
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

	test("returning user with warning enabled sees security warning", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
		});
		const { findByRole } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByRole("button", { name: "Accept & Continue" })).toBeTruthy();
	});

	test("returning user: Accept & Continue shows App", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: true }),
			acceptRisks: () => Promise.resolve({ ok: true }),
		});
		const { findByRole, findByText } = render(<AppGate />, { wrapper: MockProviders });
		const btn = await findByRole("button", { name: "Accept & Continue" });
		await clickAndFlush(btn);
		expect(await findByText("Welcome to Klovi")).toBeTruthy();
	});

	test("returning user: checking dont-show saves setting", async () => {
		const updateGeneralSettings = mock(() => Promise.resolve({ showSecurityWarning: false }));
		setupMockRPC({
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

	test("returning user with warning disabled skips to App", async () => {
		const acceptRisks = mock(() => Promise.resolve({ ok: true }));
		setupMockRPC({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
			acceptRisks: acceptRisks,
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		await findByText("Welcome to Klovi");
		expect(acceptRisks).toHaveBeenCalledTimes(1);
	});

	// --- Error handling ---

	test("shows onboarding when isFirstLaunch fails", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.reject(new Error("RPC failed")),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	test("shows onboarding when getGeneralSettings fails for returning user", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
			getGeneralSettings: () => Promise.reject(new Error("RPC failed")),
		});
		const { findByText } = render(<AppGate />, { wrapper: MockProviders });
		expect(await findByText("Session Data Notice")).toBeTruthy();
	});

	test("App renders even if acceptRisks RPC fails", async () => {
		setupMockRPC({
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

	test("shows desktop reconnect state on transport failure instead of onboarding", async () => {
		setupMockRPC({
			isFirstLaunch: () => Promise.reject(new Error("RPC request timed out.")),
		});

		const { findByText, queryByText } = render(<AppGate />, { wrapper: MockProviders });

		expect(await findByText("Connecting to Klovi desktop host...")).toBeTruthy();
		expect(queryByText("Session Data Notice")).toBeNull();
	});

	test("desktop reconnect screen retries into the app after host recovery", async () => {
		const isFirstLaunch = mock<() => Promise<{ firstLaunch: boolean }>>(() =>
			Promise.reject(new Error("RPC request timed out.")),
		);

		setupMockRPC({
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
