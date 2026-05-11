import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types";
import { MockProviders, setupMockRpc } from "../../test-helpers/mock-rpc";
import { SubAgentPresentation } from "./SubAgentPresentation";

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
				text: "Task for sub-agent",
			},
			{
				kind: "assistant",
				uuid: "a1",
				timestamp: "2025-01-15T10:00:01Z",
				model: "claude-opus-4-6",
				contentBlocks: [{ type: "text", text: "Working on it" }],
			},
		],
		...overrides,
	};
}

describe("SubAgentPresentation", () => {
	afterEach(cleanup);

	it("shows loading state initially", () => {
		setupMockRpc({
			getSubAgent: () => new Promise(noop),
		});
		const { container } = render(
			<SubAgentPresentation sessionId="session-1" project="test-project" agentId="agent-1" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".loading")).not.toBeNull();
		expect(container.textContent).toContain("Loading sub-agent conversation...");
	});

	it("renders presentation mode after fetch", async () => {
		const session = makeSession();
		setupMockRpc({
			getSubAgent: () => Promise.resolve({ session: session }),
		});

		const { container, findByText } = render(
			<SubAgentPresentation sessionId="session-1" project="test-project" agentId="agent-1" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await findByText(STEP_REGEX);
		expect(container.textContent).toContain("← → step");
	});

	it("returns null when session has no turns", async () => {
		const session = makeSession({ turns: [] });
		setupMockRpc({
			getSubAgent: () => Promise.resolve({ session: session }),
		});

		const { container } = render(
			<SubAgentPresentation sessionId="session-1" project="test-project" agentId="agent-1" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await waitFor(() => {
			expect(container.querySelector(".loading")).toBeNull();
		});
		expect(container.textContent).not.toContain("← → step");
	});

	it("returns null when session is null", async () => {
		setupMockRpc({
			getSubAgent: () => Promise.resolve({ session: null as unknown as Session }),
		});

		const { container } = render(
			<SubAgentPresentation sessionId="session-1" project="test-project" agentId="agent-1" onExit={noop} />,
			{ wrapper: MockProviders },
		);
		await waitFor(() => {
			expect(container.querySelector(".loading")).toBeNull();
		});
		expect(container.textContent).not.toContain("← → step");
	});
});
