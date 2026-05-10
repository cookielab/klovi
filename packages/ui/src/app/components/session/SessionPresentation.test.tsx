import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc";
import { SessionPresentation } from "./SessionPresentation";


const noop = (): undefined => undefined;
const STEP_REGEX = /Step/u;

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		sessionId: "session-1",
		project: "test-project",
		turns: [
			{
				kind: "user",
				uuid: "u1",
				timestamp: "2025-01-15T10:00:00Z",
				text: "Hello",
			},
			{
				kind: "assistant",
				uuid: "a1",
				timestamp: "2025-01-15T10:00:01Z",
				model: "claude-opus-4-6",
				contentBlocks: [{ type: "text", text: "Response" }],
			},
		],
		...overrides,
	};
}

describe("SessionPresentation", () => {
	afterEach(cleanup);

	it("shows loading state initially", () => {
		setupMockRPC({
			getSessionHead: () => new Promise(noop),
		});
		const { container } = render(
			<SessionPresentation sessionId="session-1" project="test-project" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".loading")).not.toBeNull();
	});

	it("renders presentation mode after fetch", async () => {
		const session = makeSession();
		setupMockRPC({
			getSessionHead: () => Promise.resolve({ session: session, totalTurns: session.turns.length }),
			getSessionTail: () => Promise.resolve({ turns: [] }),
		});

		const { container, findByText } = render(
			<SessionPresentation sessionId="session-1" project="test-project" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await findByText(STEP_REGEX);
		expect(container.textContent).toContain("← → step");
	});

	it("renders progress bar", async () => {
		const session = makeSession();
		setupMockRPC({
			getSessionHead: () => Promise.resolve({ session: session, totalTurns: session.turns.length }),
			getSessionTail: () => Promise.resolve({ turns: [] }),
		});

		const { container, findByText } = render(
			<SessionPresentation sessionId="session-1" project="test-project" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await findByText(STEP_REGEX);
		expect(container.textContent).toContain("Esc exit");
	});

	it("returns null when no session data", async () => {
		setupMockRPC({
			getSessionHead: () => Promise.resolve({ session: null as unknown as Session, totalTurns: 0 }),
			getSessionTail: () => Promise.resolve({ turns: [] }),
		});

		const { container } = render(
			<SessionPresentation sessionId="session-1" project="test-project" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await waitFor(() => {
			expect(container.querySelector(".loading")).toBeNull();
		});
		expect(container.textContent).not.toContain("← → step");
	});
});
