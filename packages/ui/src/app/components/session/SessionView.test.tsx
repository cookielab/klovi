import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SessionView } from "./SessionView.tsx";

const ERROR_TITLE_TEXT = "Something went wrong";
const HTTP_404_DETAIL_TEXT = "HTTP 404";
const NETWORK_ERROR_DETAIL_TEXT = "Network error";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		sessionId: "session-1",
		project: "test-project",
		turns: [
			{
				kind: "user",
				uuid: "u1",
				timestamp: "2025-01-15T10:00:00Z",
				text: "Hello world",
			},
			{
				kind: "assistant",
				uuid: "a1",
				timestamp: "2025-01-15T10:00:01Z",
				model: "claude-opus-4-6",
				contentBlocks: [{ type: "text", text: "Hi there!" }],
			},
		],
		...overrides,
	};
}

describe("SessionView", () => {
	afterEach(cleanup);

	test("shows loading state initially", () => {
		setupMockRPC({
			getSessionHead: () => new Promise(() => {}),
		});
		const { container } = render(<SessionView sessionId="session-1" project="test-project" />, {
			wrapper: MockProviders,
		});
		expect(container.querySelector(".loading")).not.toBeNull();
		expect(container.textContent).toContain("Loading session...");
	});

	test("renders messages after successful fetch", async () => {
		const session = makeSession();
		setupMockRPC({
			getSessionHead: () => Promise.resolve({ session: session, totalTurns: session.turns.length }),
			getSessionTail: () => Promise.resolve({ turns: [] }),
		});

		const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />, {
			wrapper: MockProviders,
		});
		expect(await findByText("Hello world")).toBeTruthy();
	});

	test("shows error state on fetch failure", async () => {
		setupMockRPC({
			getSessionHead: () => Promise.reject(new Error("HTTP 404")),
		});

		const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />, {
			wrapper: MockProviders,
		});
		expect(await findByText(ERROR_TITLE_TEXT)).toBeTruthy();
		expect(await findByText(HTTP_404_DETAIL_TEXT)).toBeTruthy();
	});

	test("shows error state on network error", async () => {
		setupMockRPC({
			getSessionHead: () => Promise.reject(new Error("Network error")),
		});

		const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />, {
			wrapper: MockProviders,
		});
		expect(await findByText(ERROR_TITLE_TEXT)).toBeTruthy();
		expect(await findByText(NETWORK_ERROR_DETAIL_TEXT)).toBeTruthy();
	});

	test("renders both user and assistant messages", async () => {
		const session = makeSession();
		setupMockRPC({
			getSessionHead: () => Promise.resolve({ session: session, totalTurns: session.turns.length }),
			getSessionTail: () => Promise.resolve({ turns: [] }),
		});

		const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />, {
			wrapper: MockProviders,
		});
		expect(await findByText("Hello world")).toBeTruthy();
		expect(await findByText("User")).toBeTruthy();
		expect(await findByText("Assistant")).toBeTruthy();
	});
});
